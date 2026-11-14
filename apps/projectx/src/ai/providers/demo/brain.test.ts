import { describe, expect, it } from 'vitest';
import { emptyBooking, isReady, type Booking, type Lang } from '../../../models/booking';
import type { AssistantResponse, ChatImage } from '../../types';
import { demoRespond } from './brain';
import { detectLang } from './nlu';

const NOW = '2026-11-14T10:00:00';
function chat() {
  let booking: Booking = emptyBooking();
  let lang: Lang | null = null;
  const log: AssistantResponse[] = [];
  const send = (text: string, images?: ChatImage[]) => {
    const r = demoRespond({ mode: 'collect', messages: [{ id: 'm', role: 'user', text, images, at: 0 }], booking, lang, now: NOW });
    booking = r.booking;
    lang = r.lang;
    log.push(r);
    return r;
  };
  return { send, get b() { return booking; }, log };
}

describe('language detection', () => {
  it.each([
    ['بغيت نصيفط شي حوايج ديال الدار من الدار البيضاء للداخلة', 'darija'],
    ['أريد نقل ثلاجة من الدار البيضاء إلى المحمدية من فضلك', 'ar'],
    ['Je veux transporter ce réfrigérateur de Casablanca à Mohammedia.', 'fr'],
    ['I need to move some construction materials from Casablanca to Settat.', 'en'],
    ['bghit n9el wahed tlaja mn casa l rbat', 'darija'],
    ['بغيت transport ديال هاد meuble من Casablanca ل Rabat.', 'darija'],
  ])('%s → %s', (t, l) => expect(detectLang(t, null)).toBe(l));
});

describe('the spec conversation (photo of a fridge → Ain Sebaa → Mohammedia)', () => {
  it('follows the expected path', () => {
    const c = chat();
    let r = c.send('I want to move a refrigerator');
    expect(c.b.cargo.items).toEqual([{ key: 'fridge', qty: 1 }]);
    expect(r.booking.meta.pending).toBe('items_confirmed');
    r = c.send('Yes, just the refrigerator.');
    expect(r.booking.meta.pending).toBe('pickup');
    r = c.send('Casablanca, Ain Sebaa.');
    expect(c.b.pickup?.id).toBe('ainsebaa');
    expect(r.booking.meta.pending).toBe('destination');
    r = c.send('Mohammedia.');
    expect(c.b.destination?.id).toBe('mohammedia');
    expect(r.booking.meta.pending).toBe('weight');
    expect(r.reply).toMatch(/60–90 kg/);
    r = c.send('use the estimate');
    expect(c.b.cargo.weight_source).toBe('estimate');
    expect(c.b.cargo.estimated_weight_kg).toBe(75);
    expect(r.booking.meta.pending).toBe('schedule');
  });
});

describe('Darija home move, full journey to ready', () => {
  it('collects everything and becomes ready', () => {
    const c = chat();
    let r = c.send('بغيت نصيفط شي حوايج ديال الدار من الدار البيضاء للداخلة');
    expect(r.lang).toBe('darija');
    expect(c.b.cargo.category).toBe('home_move');
    expect(c.b.pickup?.id).toBe('casablanca');
    expect(c.b.destination?.id).toBe('dakhla');
    expect(c.b.cargo.weight_source).toBe('estimate');
    expect(r.booking.meta.pending).toBe('schedule');
    r = c.send('غدا الصباح');
    expect(c.b.schedule).toMatchObject({ mode: 'scheduled', date: '2026-11-15', time: '09:00' });
    r = c.send('التحميل والتفريغ');
    expect(c.b.assistance).toMatchObject({ loading: true, unloading: true });
    r = c.send('3 خدامة');
    expect(c.b.assistance.helpers).toBe(3);
    r = c.send('الطابق 3 ماكاينش السانسور');
    expect(c.b.pickup).toMatchObject({ floor: 3, elevator: false });
    r = c.send('الطابق الأرضي');
    expect(c.b.destination?.floor).toBe(0);
    r = c.send('غادي نمشي معاه');
    expect(c.b.passengers).toEqual({ accompany: true, count: 1 });
    r = c.send('بجوج مزيانين');
    expect(c.b.shared_transport_accepted).toBe(true);
    expect(c.b.return_trip_accepted).toBe(true);
    r = c.send('عيط ليا ملي توصل');
    expect(c.b.instructions).toContain('عيط');
    expect(r.ready).toBe(true);
    expect(isReady(c.b)).toBe(true);
  });
});

describe('corrections and contradictions', () => {
  it('changes the destination and says so', () => {
    const c = chat();
    c.send('Je veux transporter un frigo de Casablanca à Mohammedia demain à 10h');
    expect(c.b.destination?.id).toBe('mohammedia');
    expect(c.b.schedule.time).toBe('10:00');
    const r = c.send('Non, pas Mohammedia, plutôt Rabat');
    expect(c.b.destination?.id).toBe('rabat');
    expect(r.reply).toMatch(/Mohammedia.*Rabat/);
  });
  it('updates a quantity and adds an item', () => {
    const c = chat();
    c.send('I need to move a sofa from Rabat to Salé');
    c.send('actually 2 sofas, and also a washing machine');
    expect(c.b.cargo.items).toEqual([{ key: 'sofa', qty: 2 }, { key: 'washer', qty: 1 }]);
  });
  it('questions an implausible weight', () => {
    const c = chat();
    c.send('a fridge from Casablanca to Rabat');
    c.send('yes');
    const r = c.send('5 kg');
    expect(r.booking.meta.pending).toBe('confirm_weight');
    c.send('no, about 80 kg');
    expect(c.b.cargo.estimated_weight_kg).toBe(80);
  });
  it('flags the same pickup and destination', () => {
    const c = chat();
    c.send('boxes from Rabat to Rabat');
    c.send('yes');
    const r = c.send('20 kg');
    expect(r.booking.meta.pending === 'same_place' || c.log.some((l) => l.booking.meta.pending === 'same_place')).toBe(true);
  });
  it('warns about stairs without an elevator', () => {
    const c = chat();
    c.send('I want to move a wardrobe from Maarif to Agdal tomorrow at 9');
    c.send('yes that is all');
    c.send('use the estimate');
    c.send('loading and unloading');
    c.send('1 helper');
    const r = c.send('4th floor, no elevator');
    expect(c.b.pickup).toMatchObject({ floor: 4, elevator: false });
    expect(r.booking.meta.pending).toBe('stairs');
    c.send('yes');
    expect(c.b.assistance.helpers).toBe(2);
  });
  it('construction: asks quantity, not floors', () => {
    const c = chat();
    let r = c.send('I need to move some construction materials from Casablanca to Settat.');
    expect(c.b.cargo.category).toBe('construction');
    expect(r.booking.meta.pending).toBe('quantity');
    r = c.send('3 tons');
    expect(c.b.cargo.estimated_weight_kg).toBe(3000);
    expect(r.booking.meta.pending).toBe('schedule');
    c.send('now');
    r = c.send('unloading only');
    expect(c.b.assistance).toMatchObject({ loading: false, unloading: true });
    expect(['helpers', 'passengers']).toContain(r.booking.meta.pending);
  });
  it('mixed language: Darija with French words', () => {
    const c = chat();
    const r = c.send('بغيت transport ديال هاد meuble من Casablanca ل Rabat.');
    expect(r.lang).toBe('darija');
    expect(c.b.cargo.items[0].key).toBe('meuble');
    expect(c.b.pickup?.id).toBe('casablanca');
    expect(c.b.destination?.id).toBe('rabat');
  });
  it('sample photo is read, unknown photo is honest', () => {
    const c = chat();
    let r = c.send('', [{ id: 'p1', dataUrl: '', sample: 'room' }]);
    expect(c.b.cargo.items.map((i) => i.key)).toEqual(['sofa', 'boxes', 'table']);
    expect(r.reply).toMatch(/sofa/);
    const d = chat();
    r = d.send('', [{ id: 'p2', dataUrl: 'data:' }]);
    expect(r.reply).toMatch(/demo mode/);
  });
  it('time without a date means today; "3" alone is 15:00', () => {
    const c = chat();
    c.send('box from Rabat to Temara at 3');
    expect(c.b.schedule).toMatchObject({ mode: 'scheduled', date: '2026-11-14', time: '15:00' });
  });
  it('"1 helper" is not a time', () => {
    const c = chat();
    c.send('a sofa from Rabat to Salé tomorrow at 10');
    c.send('1 helper');
    expect(c.b.schedule.time).toBe('10:00');
    expect(c.b.assistance.helpers).toBe(1);
  });
});
