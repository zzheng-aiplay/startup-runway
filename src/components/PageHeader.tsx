import { HeaderMark } from './HeaderMark'

const HEADLINE = 'How much should we raise?'

/**
 * Headline, a static mark, and the scenario tabs.
 *
 * There used to be a three-number answer strip and a plain-English sentence here.
 * Both restated the four stat cells in the rail, which sit at the same height and
 * stay put while you scroll — so the page said the same thing twice before asking a
 * single question. A condensed sticky bar followed you down for a while too; it
 * duplicated the rail on desktop and stole 40px from a phone.
 */
export function PageHeader({
  tabs,
  theme,
}: {
  tabs: React.ReactNode
  theme: React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 pb-7">
        <div className="grow basis-[24ch] min-w-[17rem]">
          <h1 className="t-headline" style={{ maxWidth: '30ch' }}>
            {HEADLINE}
          </h1>
          <HeaderMark />
        </div>
        <div className="flex flex-col items-end gap-4">
          {theme}
          {tabs}
        </div>
      </div>
    </div>
  )
}
