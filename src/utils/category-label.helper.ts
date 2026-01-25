/**
 * Helper to generate category labels in Portuguese
 */
export class CategoryLabelHelper {
  /**
   * Get Portuguese label for any category type
   */
  static getLabel(
    category: 
      | 'DAILY' 
      | 'WEEKLY' 
      | 'MONTHLY' 
      | 'YEARLY'
      | 'ACTIVE'
  ): string {
    switch (category) {
      case 'DAILY':
        return 'Diário';
      case 'WEEKLY':
        return 'Semanal';
      case 'MONTHLY':
        return 'Mensal';
      case 'YEARLY':
        return 'Anual';
      case 'ACTIVE':
        return 'Ativos';
      default:
        return category;
    }
  }

  /**
   * Generate formatted date string DD MM YYYY
   */
  static getFormattedDate(): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${day} ${month} ${year}`;
  }

  /**
   * Generate giveaway name
   * Format: "Sorteio de {type} - {category} - DD MM YYYY"
   */
  static generateGiveawayName(
    type: string,
    category: string,
  ): string {
    const categoryLabel = this.getLabel(category as any);
    const date = this.getFormattedDate();
    return `Sorteio de ${type} - ${categoryLabel} - ${date}`;
  }
}

