"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // pathname starts with /en or /ko, e.g. /en/cms
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
      <button
        onClick={() => handleLanguageChange('ko')}
        className={`px-3 py-1.5 text-xs font-bold transition-colors ${
          locale === 'ko'
            ? 'bg-emerald-600 text-white'
            : 'bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        한국어
      </button>
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-slate-200 ${
          locale === 'en'
            ? 'bg-emerald-600 text-white'
            : 'bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        EN
      </button>
    </div>
  );
}
