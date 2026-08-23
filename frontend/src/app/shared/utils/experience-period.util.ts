import { Language } from '@core/services/language.service';
import { Experience } from '@shared/models/experience.model';

const MONTH_NAMES: Record<Language, string[]> = {
  fr: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  de: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ],
};

export function formatMonthYear(isoDate: string, lang: Language): string {
  const [year, month] = isoDate.split('-');
  return `${MONTH_NAMES[lang][Number(month) - 1]} ${year}`;
}

export function formatExperiencePeriod(
  exp: Experience,
  lang: Language,
  todayLabel: string
): string {
  const start = formatMonthYear(exp.dateDebut, lang);
  const end = exp.current ? todayLabel : formatMonthYear(exp.dateFin!, lang);
  return `${start} — ${end}`;
}
