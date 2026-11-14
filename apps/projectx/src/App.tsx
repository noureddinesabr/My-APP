import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XProvider, useX } from './booking/store';
import { Welcome } from './components/Welcome';
import { Assistant } from './components/Assistant';
import { Market } from './components/Market';
import { Trip } from './components/Trip';

function Screens() {
  const { s, ui, rtl } = useX();
  useEffect(() => {
    document.documentElement.lang = ui;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [ui, rtl]);
  const screen = s.screen === 'trip' && !s.trip ? 'chat' : s.screen === 'market' && !s.booking.pickup ? 'chat' : s.screen;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={screen}
        className="h-[100dvh] w-full"
        initial={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 1.01, filter: 'blur(6px)' }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {screen === 'welcome' && <Welcome />}
        {screen === 'chat' && <Assistant />}
        {screen === 'market' && <Market />}
        {screen === 'trip' && <Trip />}
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <XProvider>
      <Screens />
    </XProvider>
  );
}
