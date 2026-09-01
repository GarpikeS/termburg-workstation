import { ArrowLeft, FileCheck2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const OPERATOR = 'ИП Сиваева Юлия Владимировна';

interface LegalScreenProps {
  kind: 'privacy' | 'consent';
}

export function LegalScreen({ kind }: LegalScreenProps) {
  const navigate = useNavigate();
  const privacy = kind === 'privacy';

  return (
    <div className="h-full flex flex-col bg-dark-surface">
      <header className="screen-safe-header px-5 pb-4">
        <div className="grid grid-cols-[44px_1fr_44px] items-center">
          <button
            type="button"
            aria-label="Назад"
            onClick={() => navigate(-1)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft size={21} />
          </button>
          <h1 className="text-center font-heading text-xs font-bold uppercase tracking-wider text-primary">
            {privacy ? 'Политика конфиденциальности' : 'Согласие на обработку данных'}
          </h1>
          <span aria-hidden="true" />
        </div>
      </header>
      <div className="gold-separator" />

      <main className="phone-scroll flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-white/70">
        <article className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.045] p-5">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] p-3">
            {privacy ? <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={22} /> : <FileCheck2 className="mt-0.5 shrink-0 text-primary" size={22} />}
            <div>
              <p className="font-heading text-base text-white">{privacy ? 'Как мы защищаем ваши данные' : 'На что вы даёте согласие'}</p>
              <p className="mt-1 text-xs text-white/45">Редакция от 15 августа 2026 года</p>
            </div>
          </div>

          {privacy ? <PrivacyContent /> : <ConsentContent />}
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h2 className="font-heading text-sm text-primary">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. Оператор данных">
        <p>{OPERATOR}, ИНН 246308389092, ОГРНИП 313246823200112.</p>
        <p>Связаться по вопросам персональных данных: <a className="text-primary underline underline-offset-2" href="mailto:info@termburg.ru">info@termburg.ru</a>.</p>
      </Section>

      <Section title="2. Какие данные обрабатываются">
        <ul className="list-disc space-y-1 pl-5">
          <li>имя, номер телефона и выбранный город;</li>
          <li>игровой прогресс, термокоины, покупки, призы и обращения в поддержку;</li>
          <li>технический идентификатор устройства, cookie сессии, IP-адрес, дата и время действий.</li>
        </ul>
        <p>Пароль не хранится в открытом виде: на сервере сохраняется только одностороннее защищённое значение. Мы не запрашиваем паспортные данные или данные банковской карты для входа в игру.</p>
      </Section>

      <Section title="3. Цели обработки">
        <ul className="list-disc space-y-1 pl-5">
          <li>создание профиля и вход по номеру телефона и паролю;</li>
          <li>сохранение прогресса между устройствами;</li>
          <li>начисление термокоинов, выдача и защита призов;</li>
          <li>предотвращение злоупотреблений и техническая поддержка.</li>
        </ul>
        <p>Номер телефона используется для входа, а не для рекламной рассылки. Реклама по телефону требует отдельного согласия.</p>
      </Section>

      <Section title="4. Как обрабатываются и хранятся данные">
        <p>Обработка выполняется автоматизированно: сбор, запись, систематизация, хранение, уточнение, использование, блокирование и удаление. Полный номер телефона в базе профилей не хранится: используется защищённое контрольное значение и последние четыре цифры для отображения.</p>
        <p>Сессия входа действует до 30 дней. Журнал неудачных попыток входа удаляется не позднее чем через 24 часа. Остальные данные хранятся до достижения целей обработки, удаления профиля или отзыва согласия, если закон не требует более длительного срока.</p>
      </Section>

      <Section title="5. Передача данных">
        <p>Техническим поставщикам хостинга передаются только данные, необходимые для работы сайта. Номер не передаётся внешним сервисам для входа. Данные не продаются и не используются третьими лицами для самостоятельной рекламы.</p>
      </Section>

      <Section title="6. Защита и права пользователя">
        <p>Мы применяем шифрованное соединение HTTPS, ограничение попыток входа, защищённые cookie и контроль доступа. Пользователь вправе запросить сведения об обработке, исправление, блокирование или удаление данных, а также отозвать согласие письмом на <a className="text-primary underline underline-offset-2" href="mailto:info@termburg.ru">info@termburg.ru</a>.</p>
        <p>Если пользователю нет 18 лет, регистрация выполняется с согласия родителя или законного представителя.</p>
      </Section>
    </>
  );
}

function ConsentContent() {
  return (
    <>
      <Section title="1. Кому даётся согласие">
        <p>Настоящим пользователь свободно, своей волей и в своём интересе даёт согласие {OPERATOR}, ИНН 246308389092, ОГРНИП 313246823200112, на обработку персональных данных.</p>
      </Section>

      <Section title="2. Состав данных">
        <p>Имя, номер телефона, город, игровой прогресс, история начислений и покупок, технический идентификатор устройства, IP-адрес, cookie сессии, дата и время действий.</p>
      </Section>

      <Section title="3. Цели и действия">
        <p>Создание и защита профиля, вход по телефону и паролю, синхронизация прогресса, начисление термокоинов, выдача призов, предотвращение злоупотреблений и поддержка.</p>
        <p>Разрешаются сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, передача поставщикам хостинга в необходимом объёме, блокирование и удаление.</p>
      </Section>

      <Section title="4. Срок и отзыв">
        <p>Согласие действует до достижения целей обработки или его отзыва. Отозвать согласие и запросить удаление профиля можно по адресу <a className="text-primary underline underline-offset-2" href="mailto:info@termburg.ru">info@termburg.ru</a>. После отзыва часть данных может сохраняться, если это требуется законом.</p>
      </Section>

      <Section title="5. Подтверждение">
        <p>Устанавливая отметку в форме регистрации и создавая профиль, пользователь подтверждает, что прочитал этот текст и Политику конфиденциальности. Для пользователя младше 18 лет такое подтверждение даёт родитель или законный представитель.</p>
      </Section>
    </>
  );
}
