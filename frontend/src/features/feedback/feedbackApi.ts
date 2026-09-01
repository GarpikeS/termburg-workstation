export type FeedbackCategory = 'bug' | 'idea' | 'visual' | 'other';

export interface FeedbackPayload {
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  contact: string;
  website: string;
  page: string;
}

interface FeedbackResponse {
  ok: true;
  id: string;
}

interface FeedbackErrorBody {
  error?: string;
  field?: string;
}

export class FeedbackApiError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'FeedbackApiError';
    this.field = field;
  }
}

export async function submitFeedback(
  payload: FeedbackPayload,
  signal?: AbortSignal,
): Promise<FeedbackResponse> {
  let response: Response;

  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new FeedbackApiError('Сервер отвечает слишком долго. Попробуйте ещё раз.');
    }
    throw new FeedbackApiError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
  }

  let body: FeedbackResponse | FeedbackErrorBody = {};
  try {
    body = await response.json() as FeedbackResponse | FeedbackErrorBody;
  } catch {
    // A readable fallback is shown below when the server did not return JSON.
  }

  if (!response.ok) {
    const errorBody = body as FeedbackErrorBody;
    throw new FeedbackApiError(
      errorBody.error || 'Не удалось отправить сообщение. Попробуйте ещё раз.',
      errorBody.field,
    );
  }

  return body as FeedbackResponse;
}
