import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { fmtP, signed } from '../lib/format.js';

// Desktop placement so the card never covers what the step is talking about
const PLACE = {
  center: 'lg:inset-x-0',
  left: 'lg:left-5 lg:right-auto lg:justify-start',
  right: 'lg:left-auto lg:right-5 lg:justify-end',
};

const rate = (tr) => (tr ? `${signed(tr.senSlopePerYear * 10)} °C per decade` : 'n/a');

// A guided demonstration on the Melbourne data. Each step sets up the app,
// then explains what the user is looking at, using the live numbers.
const STEPS = [
  {
    title: 'The question',
    place: 'center',
    run: (a) => {
      a.setCity('melbourne');
      a.setLayer('day');
      a.setMapMode('annual');
      a.setYear(2016);
      a.closeTrendLab();
      a.simulate(false);
      a.setLeftTab('winter');
    },
    text: () =>
      'Data centres turn almost all the electricity they use into heat. Does a cluster of them make its neighbourhood hotter than the area around it? Is that getting worse over time? And could the heat be put to use? Let’s investigate Melbourne’s western suburbs.',
  },
  {
    title: 'Clue 1 · The satellite view',
    place: 'center',
    run: (a) => a.play(),
    text: () =>
      'Each frame is one year of NASA MODIS Land Surface Temperature: how hot the ground and rooftops are, averaged from about 45 eight-day satellite snapshots per year. Brighter means hotter. The dashed orange ring is our “target zone” around the data-centre cluster.',
  },
  {
    title: 'Clue 2 · Compare with the surroundings',
    place: 'left',
    run: (a) => {
      a.pause();
      a.setYear(2024);
    },
    text: (L) => {
      const y16 = L?.day?.years?.['2016']?.deltaC;
      const y24 = L?.day?.years?.['2024']?.deltaC;
      return `A hot spot means little on its own, so we compare the target zone with its surroundings (the baseline). In 2016 the target zone was ${y16 != null ? signed(y16) : '?'} °C relative to the baseline. By 2024 it was ${y24 != null ? signed(y24) : '?'} °C. Check the bars in the right-hand panel.`;
    },
  },
  {
    title: 'Clue 3 · Is it a real trend?',
    place: 'right',
    run: (a) => a.openTrendLab('gap'),
    text: (L) => {
      const g = L?.day?.trends?.gap;
      return `Year-to-year numbers wobble. To call something a trend, we remove the seasonal cycle and run a Mann-Kendall test. The heat-island gap is changing at ${rate(g)} (${fmtP(g?.mkP)}). ${g?.mkP < 0.05 ? 'That is statistically significant.' : 'That is not yet significant.'}`;
    },
  },
  {
    title: 'A false clue!',
    place: 'right',
    run: (a) => a.openTrendLab('target'),
    text: (L) =>
      `Now look at the target zone on its own: ${rate(L?.day?.trends?.target)}. Did it really cool that much? No. NASA’s Terra satellite has been drifting to an earlier overpass time since 2020, so it now sees cooler mornings. Good detectives check their instruments. The gap compares areas seen in the same pass, so the drift cancels out.`,
  },
  {
    title: 'Clue 4 · Where is it changing?',
    place: 'center',
    run: (a) => {
      a.closeTrendLab();
      a.setMapMode('trend');
    },
    text: () =>
      'This map runs the same trend test on every 1 km pixel. Red is warming, blue is cooling, and faded pixels are not significant. Even with the orbit drift affecting all pixels, you can see where the area around the data centres stands out from its neighbours.',
  },
  {
    title: 'Clue 5 · Day vs. night',
    place: 'right',
    run: (a) => {
      a.setLayer('night');
      a.openTrendLab('gap');
    },
    text: (L) => {
      const g = L?.night?.trends?.gap;
      return `At night the gap changes at ${rate(g)} (${fmtP(g?.mkP)}). ${g?.mkP < 0.05 ? 'This is significant too.' : 'That is not significant: in this record the effect shows up in daytime surfaces, not at night.'} Reporting a “no” result honestly is part of good science.`;
    },
  },
  {
    title: 'Why it matters: winter',
    place: 'right',
    run: (a) => {
      a.setLayer('day');
      a.setMapMode('annual');
      a.openTrendLab('hdd');
      a.setLeftTab('winter');
    },
    text: () =>
      'NASA MERRA-2 climate data shows how much heating homes need each winter (heating degree-days). The need is slowly falling as winters warm, but thousands of homes still burn gas every winter while the data centres dump heat.',
  },
  {
    title: 'Put the heat to work',
    place: 'right',
    run: (a) => {
      a.closeTrendLab();
      a.simulate(true);
    },
    text: () =>
      'Now route the waste heat to nearby neighbourhoods. Use the sliders on the left to change how much heat is captured and how efficient the heat pumps are, and see how many homes are heated, the bill savings, and whether CO₂ actually goes down on the local grid.',
  },
];

export default function CaseFileTour({ step, onStep, actions, layerData }) {
  const s = step != null ? STEPS[step] : null;

  const go = (i) => {
    if (i < 0 || i >= STEPS.length) {
      onStep(null);
      return;
    }
    STEPS[i].run(actions);
    onStep(i);
  };

  return (
    <AnimatePresence>
      {s && (
        <div
          key="tour"
          className={`pointer-events-none absolute inset-x-4 bottom-4 z-[1200] flex justify-center lg:bottom-auto lg:top-[96px] ${PLACE[s.place]}`}
        >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className={`glass pointer-events-auto w-full max-w-[440px] rounded-2xl border border-teal-400/30 p-4 shadow-[0_0_30px_rgba(45,212,191,0.25),0_12px_40px_rgba(0,0,0,0.6)] ${s.place === 'center' ? '' : 'lg:max-w-[330px]'}`}
          role="dialog"
          aria-label="Case file guided tour"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">
              <Search className="h-3.5 w-3.5" /> Case file · {step + 1}/{STEPS.length}
            </div>
            <button type="button" onClick={() => onStep(null)} aria-label="Close tour" className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{s.text(layerData)}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-4 bg-teal-400' : 'w-1.5 bg-white/20'}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go(step - 1)}
                disabled={step === 0}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => go(step + 1)}
                className="flex items-center gap-1 rounded-lg border border-teal-400/50 bg-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.4)] hover:bg-teal-500/30"
              >
                {step === STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export const runTourStep = (i, actions) => STEPS[i].run(actions);
