import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  addHours,
  addMinutes,
  addMonths,
  addYears,
  isAfter,
  isBefore,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 날짜 유틸리티 클래스
 *
 * 날짜 관련 공통 기능을 제공하는 유틸리티
 * - 날짜 포맷팅 (한국 로케일 지원)
 * - 날짜 계산 (더하기, 빼기, 차이 계산)
 * - 날짜 비교 및 검증
 * - 비즈니스 로직에 필요한 날짜 처리
 */
export class DateUtil {
  /**
   * 날짜를 지정된 형식의 문자열로 포맷팅
   *
   * @param date - 포맷팅할 날짜
   * @param pattern - 날짜 포맷 패턴 (기본값: 'yyyy-MM-dd HH:mm:ss')
   * @param useKoreanLocale - 한국어 로케일 사용 여부 (기본값: false)
   * @returns 포맷팅된 날짜 문자열
   *
   * @example
   * DateUtil.format(new Date(), 'yyyy-MM-dd') // '2025-10-17'
   * DateUtil.format(new Date(), 'PPP', true) // '2025년 10월 17일' (한국어)
   */
  static format(
    date: Date,
    pattern: string = 'yyyy-MM-dd HH:mm:ss',
    useKoreanLocale: boolean = false,
  ): string {
    return format(date, pattern, useKoreanLocale ? { locale: ko } : undefined);
  }

  /**
   * ISO 8601 형식의 문자열을 Date 객체로 변환
   *
   * @param dateString - ISO 8601 형식의 날짜 문자열
   * @returns Date 객체
   *
   * @example
   * DateUtil.parseISO('2025-10-17T10:00:00Z')
   */
  static parseISO(dateString: string): Date {
    return parseISO(dateString);
  }

  /**
   * 현재 날짜/시간 반환
   *
   * @returns 현재 Date 객체
   */
  static now(): Date {
    return new Date();
  }

  /**
   * 날짜에 일수 더하기
   *
   * @param date - 기준 날짜
   * @param days - 더할 일수
   * @returns 계산된 Date 객체
   *
   * @example
   * DateUtil.addDays(new Date(), 7) // 7일 후
   */
  static addDays(date: Date, days: number): Date {
    return addDays(date, days);
  }

  /**
   * 날짜에서 일수 빼기
   *
   * @param date - 기준 날짜
   * @param days - 뺄 일수
   * @returns 계산된 Date 객체
   *
   * @example
   * DateUtil.subDays(new Date(), 7) // 7일 전
   */
  static subDays(date: Date, days: number): Date {
    return subDays(date, days);
  }

  /**
   * 날짜에 시간 더하기
   *
   * @param date - 기준 날짜
   * @param hours - 더할 시간
   * @returns 계산된 Date 객체
   */
  static addHours(date: Date, hours: number): Date {
    return addHours(date, hours);
  }

  /**
   * 날짜에 분 더하기
   *
   * @param date - 기준 날짜
   * @param minutes - 더할 분
   * @returns 계산된 Date 객체
   */
  static addMinutes(date: Date, minutes: number): Date {
    return addMinutes(date, minutes);
  }

  /**
   * 날짜에 개월 수 더하기
   *
   * @param date - 기준 날짜
   * @param months - 더할 개월 수
   * @returns 계산된 Date 객체
   */
  static addMonths(date: Date, months: number): Date {
    return addMonths(date, months);
  }

  /**
   * 날짜에 년 수 더하기
   *
   * @param date - 기준 날짜
   * @param years - 더할 년 수
   * @returns 계산된 Date 객체
   */
  static addYears(date: Date, years: number): Date {
    return addYears(date, years);
  }

  /**
   * 하루의 시작 시간 반환 (00:00:00)
   *
   * @param date - 기준 날짜
   * @returns 하루의 시작 시간 Date 객체
   *
   * @example
   * DateUtil.startOfDay(new Date('2025-10-17 15:30:00'))
   * // 2025-10-17 00:00:00
   */
  static startOfDay(date: Date): Date {
    return startOfDay(date);
  }

  /**
   * 하루의 마지막 시간 반환 (23:59:59.999)
   *
   * @param date - 기준 날짜
   * @returns 하루의 마지막 시간 Date 객체
   *
   * @example
   * DateUtil.endOfDay(new Date('2025-10-17 15:30:00'))
   * // 2025-10-17 23:59:59.999
   */
  static endOfDay(date: Date): Date {
    return endOfDay(date);
  }

  /**
   * 두 날짜 간의 일수 차이 계산
   *
   * @param dateLeft - 비교할 날짜 1
   * @param dateRight - 비교할 날짜 2
   * @returns 일수 차이 (양수: dateLeft가 더 나중, 음수: dateLeft가 더 이전)
   *
   * @example
   * DateUtil.differenceInDays(new Date('2025-10-17'), new Date('2025-10-10'))
   * // 7
   */
  static differenceInDays(dateLeft: Date, dateRight: Date): number {
    return differenceInDays(dateLeft, dateRight);
  }

  /**
   * 두 날짜 간의 시간 차이 계산
   *
   * @param dateLeft - 비교할 날짜 1
   * @param dateRight - 비교할 날짜 2
   * @returns 시간 차이
   */
  static differenceInHours(dateLeft: Date, dateRight: Date): number {
    return differenceInHours(dateLeft, dateRight);
  }

  /**
   * 두 날짜 간의 분 차이 계산
   *
   * @param dateLeft - 비교할 날짜 1
   * @param dateRight - 비교할 날짜 2
   * @returns 분 차이
   */
  static differenceInMinutes(dateLeft: Date, dateRight: Date): number {
    return differenceInMinutes(dateLeft, dateRight);
  }

  /**
   * 날짜 비교: dateLeft가 dateRight보다 나중인지 확인
   *
   * @param dateLeft - 비교할 날짜 1
   * @param dateRight - 비교할 날짜 2
   * @returns dateLeft > dateRight 여부
   */
  static isAfter(dateLeft: Date, dateRight: Date): boolean {
    return isAfter(dateLeft, dateRight);
  }

  /**
   * 날짜 비교: dateLeft가 dateRight보다 이전인지 확인
   *
   * @param dateLeft - 비교할 날짜 1
   * @param dateRight - 비교할 날짜 2
   * @returns dateLeft < dateRight 여부
   */
  static isBefore(dateLeft: Date, dateRight: Date): boolean {
    return isBefore(dateLeft, dateRight);
  }

  /**
   * 날짜가 특정 범위 내에 있는지 확인
   *
   * @param date - 확인할 날짜
   * @param start - 시작 날짜
   * @param end - 종료 날짜
   * @returns 범위 내 포함 여부
   */
  static isWithinRange(date: Date, start: Date, end: Date): boolean {
    return !isBefore(date, start) && !isAfter(date, end);
  }

  /**
   * 날짜를 한국 표준시(KST) 문자열로 변환
   *
   * @param date - 변환할 날짜
   * @returns KST 시간 문자열
   *
   * @example
   * DateUtil.toKST(new Date()) // '2025-10-17 15:30:00 KST'
   */
  static toKST(date: Date): string {
    return this.format(date, 'yyyy-MM-dd HH:mm:ss') + ' KST';
  }

  /**
   * 오늘 날짜의 시작과 끝 반환
   *
   * @returns { start: Date, end: Date } 오늘의 시작과 끝
   *
   * @example
   * const { start, end } = DateUtil.getTodayRange();
   * // start: 2025-10-17 00:00:00
   * // end: 2025-10-17 23:59:59.999
   */
  static getTodayRange(): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: this.startOfDay(today),
      end: this.endOfDay(today),
    };
  }

  /**
   * 특정 날짜의 범위 반환
   *
   * @param date - 기준 날짜
   * @returns { start: Date, end: Date } 날짜의 시작과 끝
   */
  static getDateRange(date: Date): { start: Date; end: Date } {
    return {
      start: this.startOfDay(date),
      end: this.endOfDay(date),
    };
  }

  /**
   * N일 전부터 오늘까지의 범위 반환
   *
   * @param days - 과거 일수
   * @returns { start: Date, end: Date } 날짜 범위
   *
   * @example
   * const { start, end } = DateUtil.getLastNDaysRange(7);
   * // 지난 7일간의 범위
   */
  static getLastNDaysRange(days: number): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: this.startOfDay(this.subDays(today, days - 1)),
      end: this.endOfDay(today),
    };
  }

  /**
   * 타임스탬프를 Date 객체로 변환
   *
   * @param timestamp - Unix 타임스탬프 (밀리초)
   * @returns Date 객체
   */
  static fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  /**
   * Date 객체를 Unix 타임스탬프로 변환
   *
   * @param date - 변환할 날짜
   * @returns Unix 타임스탬프 (밀리초)
   */
  static toTimestamp(date: Date): number {
    return date.getTime();
  }
}
