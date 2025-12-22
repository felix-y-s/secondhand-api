/**
 * 공통 응답 인터페이스
 */
export interface Response<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  timestamp?: string;
}
