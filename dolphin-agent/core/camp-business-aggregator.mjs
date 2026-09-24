const DAY_MS = 86_400_000;
const MAX_DTO_DAYS = 62;
const MOSCOW_TIMEZONE = 'Europe/Moscow';

const RESOURCE_NAMES = Object.freeze([
  'accounts',
  'cards',
  'skudAreas',
  'skudControllers',
  'skudVerifyLogs',
  'accountPayments',
]);

const SCHEMA_HASH_RESOURCE_NAMES = new Set([...RESOURCE_NAMES, 'kkmCheques']);

const UPLOAD_BLOCKERS = new Set([
  'unresolved-controller-events',
  'unresolved-staff-events',
  'no-safely-classified-guest-controller',
  'incomplete-resource',
  'schema-changed',
  'source-unavailable',
  'fiscal-semantics-unconfirmed',
]);

const FIELD_ALIASES = Object.freeze({
  id: ['ID', 'id'],
  dateAction: ['DATEACTION', 'dateAction'],
  dateDoc: ['DATEDOC', 'dateDoc'],
  idController: ['IDCONTROLLER', 'idController'],
  idReader: ['IDREADER', 'idReader'],
  isAllow: ['ISALLOW', 'isAllow'],
  readerIn: ['READERIN', 'readerIn'],
  readerOut: ['READEROUT', 'readerOut'],
  idAccount: ['IDACCOUNT', 'idAccount'],
  idCard: ['IDCARD', 'idCard'],
  status: ['STATUS', 'status'],
  isStaff: ['ISSTAFF', 'isStaff'],
  isStaffCard: ['ISSTAFFCARD', 'isStaffCard'],
  idArea: ['IDAREA', 'idArea'],
  kind: ['KIND', 'kind'],
  isCheckBalance: ['ISCHECKBALANCE', 'isCheckBalance'],
  isNotFiscal: ['ISNOTFISCAL', 'isNotFiscal'],
  amount: ['SUMMA', 'summa', 'amount'],
});

function ownField(row, aliases) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return { found: false, value: undefined };
  for (const key of aliases) {
    if (Object.hasOwn(row, key)) return { found: true, value: row[key] };
  }
  return { found: false, value: undefined };
}

function field(row, name) {
  return ownField(row, FIELD_ALIASES[name]);
}

function integer(value) {
  if (typeof value === 'boolean') return { ok: true, value: value ? 1 : 0 };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, value: null };
  }
  if (typeof value === 'string' && /^-?\d+$/u.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? { ok: true, value: parsed } : { ok: false, value: null };
  }
  return { ok: false, value: null };
}

function nullableInteger(input) {
  if (!input.found) return { ok: false, value: null };
  if (input.value === null) return { ok: true, value: null };
  return integer(input.value);
}

function identifier(input) {
  const parsed = nullableInteger(input);
  return parsed.ok && parsed.value !== null
    ? { ok: true, value: String(parsed.value) }
    : { ok: false, value: null };
}

function calendarDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return '';
  const normalized = match[0];
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : '';
}

function moscowDateKey(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const part = type => parts.find(item => item.type === type)?.value || '';
  return calendarDate(`${part('year')}-${part('month')}-${part('day')}`);
}

function rowDate(input) {
  if (!input.found || input.value === null || input.value === '') return '';
  if (typeof input.value === 'string') {
    const localPrefix = input.value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/u)?.[1] || '';
    if (calendarDate(localPrefix)) return localPrefix;
  }
  if (input.value instanceof Date || typeof input.value === 'number') {
    const timestamp = input.value instanceof Date ? input.value.getTime() : input.value;
    return Number.isFinite(timestamp) ? moscowDateKey(timestamp) : '';
  }
  const timestamp = Date.parse(String(input.value));
  return Number.isFinite(timestamp) ? moscowDateKey(timestamp) : '';
}

function rublesToKopecks(input) {
  if (!input.found || input.value === null || input.value === '' || typeof input.value === 'boolean') {
    return { ok: false, value: null };
  }
  const source = String(input.value).trim().replace(',', '.');
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d+))?$/u);
  if (!match) return { ok: false, value: null };
  const [, sign, whole, fraction = ''] = match;
  const roundedFraction = `${fraction}00`.slice(0, 3);
  let kopecks = BigInt(whole) * 100n + BigInt(roundedFraction.slice(0, 2));
  if (roundedFraction[2] >= '5') kopecks += 1n;
  if (sign === '-') kopecks = -kopecks;
  if (kopecks > BigInt(Number.MAX_SAFE_INTEGER) || kopecks < BigInt(Number.MIN_SAFE_INTEGER)) {
    return { ok: false, value: null };
  }
  return { ok: true, value: kopecks };
}

function registerStaffFlags(rows, flagName) {
  const flags = new Map();
  for (const row of rows) {
    const id = identifier(field(row, 'id'));
    const flag = nullableInteger(field(row, flagName));
    if (!id.ok || !flag.ok) continue;
    const bit = flag.value === 1 ? 2 : flag.value === 0 || flag.value === null ? 1 : 4;
    flags.set(id.value, (flags.get(id.value) || 0) | bit);
  }
  return flags;
}

function registerDefinitions(rows, definitionFields) {
  const definitions = new Map();
  for (const row of rows) {
    const id = identifier(field(row, 'id'));
    const parsed = Object.fromEntries(definitionFields.map(name => [name, nullableInteger(field(row, name))]));
    if (!id.ok || Object.values(parsed).some(value => !value.ok)) continue;
    const next = Object.fromEntries(Object.entries(parsed).map(([name, value]) => [name, value.value]));
    const previous = definitions.get(id.value);
    if (!previous) {
      definitions.set(id.value, { state: 'valid', ...next });
      continue;
    }
    const same = previous.state === 'valid'
      && Object.entries(next).every(([name, value]) => previous[name] === value);
    if (!same) definitions.set(id.value, { state: 'conflict' });
  }
  return definitions;
}

function classifyArea(definition) {
  if (!definition || definition.state !== 'valid') return 'unresolved';
  if (definition.status === null || definition.kind === null || definition.isCheckBalance === null) {
    return 'unresolved';
  }
  if (definition.status !== 0) return 'excluded';
  return definition.kind === 1 && definition.isCheckBalance === 1 ? 'eligible' : 'excluded';
}

function classifyController(definition, areas) {
  if (!definition || definition.state !== 'valid') return 'unresolved';
  if (definition.status === null || definition.idArea === null || definition.readerIn === null) {
    return 'unresolved';
  }
  if (definition.status !== 0) return 'excluded';
  return classifyArea(areas.get(String(definition.idArea)));
}

function classifyStaff(event, accountFlags, cardFlags) {
  if (!event.idAccount || !event.idCard) return 'unresolved';
  const account = accountFlags.get(event.idAccount) || 0;
  const card = cardFlags.get(event.idCard) || 0;
  const accountStaff = (account & 2) !== 0;
  const cardStaff = (card & 2) !== 0;
  const accountGuest = (account & 1) !== 0 && (account & 4) === 0;
  const cardGuest = (card & 1) !== 0 && (card & 4) === 0;
  if (accountStaff || cardStaff) return 'staff';
  return accountGuest && cardGuest ? 'guest' : 'unresolved';
}

function addBlocker(target, blocker) {
  if (UPLOAD_BLOCKERS.has(blocker) && !target.includes(blocker)) target.push(blocker);
}

function addObservedDate(target, date) {
  if (date) target.add(date);
}

function enumerateDates(from, through) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const finish = Date.parse(`${through}T00:00:00.000Z`);
  const count = Math.floor((finish - start) / DAY_MS) + 1;
  if (!Number.isInteger(count) || count < 1 || count > MAX_DTO_DAYS) {
    throw new RangeError(`Dolphin business window must contain between 1 and ${MAX_DTO_DAYS} calendar days.`);
  }
  return Array.from({ length: count }, (_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10));
}

function outputDates(options, observedDates, currentDate) {
  const requested = Array.isArray(options.dates)
    ? options.dates.map(calendarDate).filter(Boolean)
    : [];
  const all = [...new Set([...requested, ...observedDates])].sort();
  const from = calendarDate(options.from) || all[0] || currentDate;
  const through = calendarDate(options.through) || all.at(-1) || from;
  if (from > through) throw new RangeError('Dolphin business window start must not be after its end.');
  return enumerateDates(from, through);
}

function resourceArrays(value) {
  const availability = Object.fromEntries(RESOURCE_NAMES.map(name => [name, Array.isArray(value?.[name])]));
  const rows = Object.fromEntries(RESOURCE_NAMES.map(name => [name, availability[name] ? value[name] : []]));
  return { availability, rows };
}

function normalizedSchemaHashes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([name, hash]) => (
    SCHEMA_HASH_RESOURCE_NAMES.has(name) && typeof hash === 'string' && /^[a-f0-9]{64}$/iu.test(hash)
      ? [[name, hash.toLowerCase()]]
      : []
  )));
}

/**
 * Aggregates allowlisted CAMP projections without returning source identifiers or row values.
 * A missing resource blocks its metric; a present empty array is a valid zero-row result.
 */
export function aggregateCampBusinessDays(resources = {}, options = {}) {
  const { availability, rows } = resourceArrays(resources);
  const currentDate = calendarDate(options.currentDate)
    || moscowDateKey(Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now());
  const observedDates = new Set();
  const visitorEvents = new Map();
  const malformedVisitorDates = new Set();
  let malformedVisitorWithoutDate = false;

  for (const row of rows.skudVerifyLogs) {
    const date = rowDate(field(row, 'dateAction'));
    addObservedDate(observedDates, date);
    const allow = nullableInteger(field(row, 'isAllow'));
    const status = nullableInteger(field(row, 'status'));
    if ((allow.ok && allow.value !== 1) || (status.ok && status.value !== 0)) continue;
    if (!allow.ok || !status.ok) {
      if (date) malformedVisitorDates.add(date);
      else malformedVisitorWithoutDate = true;
      continue;
    }

    const idReader = identifier(field(row, 'idReader'));
    const eventReaderIn = identifier(field(row, 'readerIn'));
    if (!idReader.ok || !eventReaderIn.ok) {
      if (date) malformedVisitorDates.add(date);
      else malformedVisitorWithoutDate = true;
      continue;
    }
    if (idReader.value !== eventReaderIn.value) continue;
    if (!date) {
      malformedVisitorWithoutDate = true;
      continue;
    }

    const idController = identifier(field(row, 'idController'));
    const idAccount = identifier(field(row, 'idAccount'));
    const idCard = identifier(field(row, 'idCard'));
    const events = visitorEvents.get(date) || [];
    events.push({
      idController: idController.ok ? idController.value : null,
      idReader: idReader.value,
      idAccount: idAccount.ok ? idAccount.value : null,
      idCard: idCard.ok ? idCard.value : null,
    });
    visitorEvents.set(date, events);
  }

  const paymentTotals = new Map();
  const malformedPaymentDates = new Set();
  let malformedPaymentWithoutDate = false;
  for (const row of rows.accountPayments) {
    const date = rowDate(field(row, 'dateDoc'));
    addObservedDate(observedDates, date);
    const status = nullableInteger(field(row, 'status'));
    const isNotFiscal = nullableInteger(field(row, 'isNotFiscal'));
    if ((status.ok && status.value !== 0) || (isNotFiscal.ok && isNotFiscal.value !== 0)) continue;
    if (!status.ok || !isNotFiscal.ok) {
      if (date) malformedPaymentDates.add(date);
      else malformedPaymentWithoutDate = true;
      continue;
    }
    const amount = rublesToKopecks(field(row, 'amount'));
    if (!date || !amount.ok) {
      if (date) malformedPaymentDates.add(date);
      else malformedPaymentWithoutDate = true;
      continue;
    }
    const previous = paymentTotals.get(date) || { kopecks: 0n, rows: 0 };
    previous.kopecks += amount.value;
    previous.rows += 1;
    paymentTotals.set(date, previous);
  }

  const dates = outputDates(options, observedDates, currentDate);
  const accountFlags = registerStaffFlags(rows.accounts, 'isStaff');
  const cardFlags = registerStaffFlags(rows.cards, 'isStaffCard');
  const areas = registerDefinitions(rows.skudAreas, ['status', 'kind', 'isCheckBalance']);
  const controllers = registerDefinitions(rows.skudControllers, ['idArea', 'readerIn', 'readerOut', 'status']);
  const eligibleControllerExists = [...controllers.values()]
    .some(controller => classifyController(controller, areas) === 'eligible');
  const visitorResourcesAvailable = ['accounts', 'cards', 'skudAreas', 'skudControllers', 'skudVerifyLogs']
    .every(name => availability[name]);
  const revenueResourceAvailable = availability.accountPayments;
  const blockers = [];
  if (!visitorResourcesAvailable || !revenueResourceAvailable) addBlocker(blockers, 'incomplete-resource');
  if (visitorResourcesAvailable && !eligibleControllerExists) {
    addBlocker(blockers, 'no-safely-classified-guest-controller');
  }

  const days = dates.map(date => {
    const isOpenDay = date >= currentDate;
    let uniqueVisitors = 0;
    let visitorStatus = 'complete';

    if (isOpenDay) {
      uniqueVisitors = null;
      visitorStatus = 'incomplete';
    } else if (!visitorResourcesAvailable || !eligibleControllerExists
      || malformedVisitorWithoutDate || malformedVisitorDates.has(date)) {
      uniqueVisitors = null;
      visitorStatus = 'blocked';
      if (malformedVisitorWithoutDate || malformedVisitorDates.has(date)) {
        addBlocker(blockers, 'incomplete-resource');
      }
    } else {
      const identities = new Set();
      let unresolvedController = false;
      let unresolvedStaff = false;
      for (const event of visitorEvents.get(date) || []) {
        const controller = event.idController ? controllers.get(event.idController) : null;
        const controllerClassification = classifyController(controller, areas);
        if (controllerClassification === 'excluded') continue;
        if (controllerClassification !== 'eligible' || String(controller.readerIn) !== event.idReader) {
          unresolvedController = true;
          continue;
        }
        const staffClassification = classifyStaff(event, accountFlags, cardFlags);
        if (staffClassification === 'staff') continue;
        if (staffClassification !== 'guest') {
          unresolvedStaff = true;
          continue;
        }
        identities.add(`${event.idAccount}:${event.idCard}`);
      }
      if (unresolvedController || unresolvedStaff) {
        uniqueVisitors = null;
        visitorStatus = 'blocked';
        if (unresolvedController) addBlocker(blockers, 'unresolved-controller-events');
        if (unresolvedStaff) addBlocker(blockers, 'unresolved-staff-events');
      } else {
        uniqueVisitors = identities.size;
      }
    }

    const payment = paymentTotals.get(date) || { kopecks: 0n, rows: 0 };
    let fiscalRevenueKopecks = 0;
    let revenueStatus = 'complete';
    if (isOpenDay) {
      fiscalRevenueKopecks = null;
      revenueStatus = 'incomplete';
    } else if (!revenueResourceAvailable || malformedPaymentWithoutDate || malformedPaymentDates.has(date)
      || payment.kopecks > BigInt(Number.MAX_SAFE_INTEGER)
      || payment.kopecks < BigInt(Number.MIN_SAFE_INTEGER)) {
      fiscalRevenueKopecks = null;
      revenueStatus = 'blocked';
      if (malformedPaymentWithoutDate || malformedPaymentDates.has(date)) {
        addBlocker(blockers, 'incomplete-resource');
      }
    } else {
      fiscalRevenueKopecks = Number(payment.kopecks);
    }

    return {
      date,
      uniqueVisitors,
      visitorStatus,
      fiscalRevenueKopecks,
      revenueStatus,
      fiscalPaymentRows: payment.rows,
    };
  });

  for (const blocker of Array.isArray(options.blockers) ? options.blockers : []) addBlocker(blockers, blocker);
  return {
    days,
    quality: {
      dateExchangeUsable: options.dateExchangeUsable === true,
      blockers,
      resourceSchemaHashes: normalizedSchemaHashes(options.resourceSchemaHashes),
    },
  };
}
