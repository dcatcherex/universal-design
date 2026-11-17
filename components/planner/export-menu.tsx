'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { t } from '@/lib/planner/i18n'
import type { Locale } from '@/lib/planner/types'

export function ExportMenu({ locale, pngAvailable, wallSvgAvailable, onReport, onSvg, onPng, onWallSvg }: {
  locale: Locale; pngAvailable: boolean; wallSvgAvailable: boolean; onReport(): void; onSvg(): void; onPng(): void; onWallSvg(): void
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="outline" aria-label={t(locale, 'exports')}>{t(locale, 'exports')}</Button>} />
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={onReport}>{t(locale, 'openReport')}</DropdownMenuItem>
      <DropdownMenuItem onClick={onSvg}>{t(locale, 'downloadSvg')}</DropdownMenuItem>
      <DropdownMenuItem disabled={!pngAvailable} title={!pngAvailable ? t(locale, 'pngUnavailable') : undefined} onClick={onPng}>{pngAvailable ? t(locale, 'downloadPng') : `${t(locale, 'downloadPng')} — ${t(locale, 'pngUnavailable')}`}</DropdownMenuItem>
      <DropdownMenuItem disabled={!wallSvgAvailable} title={!wallSvgAvailable ? t(locale, 'wallSvgUnavailable') : undefined} onClick={onWallSvg}>{wallSvgAvailable ? t(locale, 'downloadWallSvg') : `${t(locale, 'downloadWallSvg')} — ${t(locale, 'wallSvgUnavailable')}`}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}
