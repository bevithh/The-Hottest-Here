import { AnimatePresence, motion } from 'framer-motion';

/**
 * Floating glass sidebar. On lg+ screens it is always docked to `side`;
 * below lg it appears as a sheet under the header when `mobileOpen`.
 */
export default function SidePanel({ side, mobileOpen, title, Icon, children }) {
  const x = side === 'left' ? -24 : 24;
  const dock = side === 'left' ? 'lg:left-5' : 'lg:right-5';

  const header = (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-teal-400" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h2>
    </div>
  );

  const shell =
    'glass rounded-2xl border border-white/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] overscroll-contain';

  return (
    <>
      <motion.aside
        initial={{ opacity: 0, x }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`absolute top-[96px] z-[900] hidden max-h-[calc(100%-240px)] w-[330px] overflow-y-auto lg:block ${dock} ${shell}`}
      >
        {header}
        {children}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-x-4 top-[132px] z-[950] max-h-[calc(100%-410px)] overflow-y-auto sm:top-[84px] lg:hidden ${shell}`}
          >
            {header}
            {children}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export function IllustrativeTag() {
  return (
    <span
      title="Placeholder figure — replace with sourced data"
      className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400"
    >
      Illustrative
    </span>
  );
}
