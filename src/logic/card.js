/**
 * トランプのカードを表すクラス
 */
export class Card {
  /**
   * @param {string} suit - マーク ('spade', 'heart', 'diamond', 'club')
   * @param {number} rank - 数字 (1-13)
   */
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
  }

  /**
   * カードの表示名を取得
   * @returns {string}
   */
  get displayName() {
    const suitMap = {
      spade: '♠',
      heart: '♥',
      diamond: '♦',
      club: '♣'
    };
    const rankMap = {
      1: 'A',
      11: 'J',
      12: 'Q',
      13: 'K'
    };
    return `${suitMap[this.suit]}${rankMap[this.rank] || this.rank}`;
  }

  /**
   * ドボン判定等で使用する数値
   * A=1, J=11, Q=12, K=13
   * @returns {number}
   */
  get value() {
    return this.rank;
  }
}
