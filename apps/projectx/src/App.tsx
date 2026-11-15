import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { XProvider, useX } from './booking/store';
import { Home } from './components/Home';
import { Scan } from './components/Scan';
import { Card } from './components/Card';
import { Market } from './components/Market';
import { Trip } from './components/Trip';

function Screens() {
  const { s, ui, rtl } = useX();
  useEffect(() => {
    document.documentElement.lang = ui;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [ui, rtl]);
  const raw = s.screen === 'chat' ? 'card' : s.screen === 'welcome' ? 'home' : s.screen;
  const screen = raw === 'trip' && !s.trip ? 'card' : raw === 'market' && !s.booking.pickup ? 'card' : raw;
  return (
    <motion.main
        key={screen}
        className="h-[100dvh] w-full"
        initial={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {screen === 'home' && <Home />}
        {screen === 'scan' && <Scan />}
        {screen === 'card' && <Card />}
        {screen === 'market' && <Market />}
        {screen === 'trip' && <Trip />}
      </motion.main>
  );
}

export default function App() {
  return (
    <XProvider>
      <Screens />
    </XProvider>
  );
}
