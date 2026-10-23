import { describe, expect, it } from 'vitest';
import { compassPoint, darkness, dayOfYear, declination, formatHour, goldenHour, shadowOffset, sunPosition, sunTimes } from './sun';

describe('sun position', () => {
  it('counts days of the year', () => {
    expect(dayOfYear(1, 1)).toBe(1);
    expect(dayOfYear(3, 1)).toBe(60);
    expect(dayOfYear(12, 31)).toBe(365);
    expect(dayOfYear(2, 31)).toBe(59); // clamped to the end of February
  });

  it('has the right declination at the solstices and equinoxes', () => {
    expect(declination(6, 21)).toBeCloseTo(23.44, 0);
    expect(declination(12, 21)).toBeCloseTo(-23.44, 0);
    expect(Math.abs(declination(3, 21))).toBeLessThan(1);
    expect(Math.abs(declination(9, 23))).toBeLessThan(1.5);
  });

  it('puts the sun due south at noon in the northern hemisphere, at the expected height', () => {
    const june = sunPosition(50, 6, 21, 12);
    expect(june.azimuth).toBeCloseTo(180, 0);
    expect(june.elevation).toBeCloseTo(90 - 50 + 23.44, 0); // 63.4°
    const dec = sunPosition(50, 12, 21, 12);
    expect(dec.elevation).toBeCloseTo(90 - 50 - 23.44, 0); // 16.6°
    // at the equator on an equinox the sun is overhead at noon
    expect(sunPosition(0, 3, 21, 12).elevation).toBeGreaterThan(88);
  });

  it('moves from east in the morning to west in the evening', () => {
    expect(sunPosition(50, 6, 21, 8).azimuth).toBeLessThan(180);
    expect(sunPosition(50, 6, 21, 8).azimuth).toBeGreaterThan(60);
    expect(sunPosition(50, 6, 21, 16).azimuth).toBeGreaterThan(180);
    expect(sunPosition(50, 6, 21, 16).azimuth).toBeLessThan(300);
    const am = sunPosition(50, 3, 21, 6);
    expect(am.azimuth).toBeCloseTo(90, -1); // due east at 6:00 on the equinox
    expect(am.elevation).toBeCloseTo(0, -1);
    expect(sunPosition(50, 3, 21, 18).azimuth).toBeCloseTo(270, -1);
  });

  it('is below the horizon at night, and south of the equator the sun is in the north', () => {
    expect(sunPosition(50, 6, 21, 0).elevation).toBeLessThan(-10);
    const south = sunPosition(-35, 12, 21, 12);
    expect(south.azimuth < 5 || south.azimuth > 355).toBe(true);
  });

  it('knows sunrise and sunset, and polar day and night', () => {
    const t = sunTimes(50, 6, 21);
    expect(t).not.toBe('polar-day');
    if (typeof t !== 'string') {
      expect(t.sunrise).toBeLessThan(5);
      expect(t.sunset).toBeGreaterThan(19);
      expect((t.sunrise + t.sunset) / 2).toBeCloseTo(12, 9);
    }
    const w = sunTimes(50, 12, 21);
    if (typeof w !== 'string') expect(w.sunset - w.sunrise).toBeLessThan(9);
    expect(sunTimes(70, 6, 21)).toBe('polar-day');
    expect(sunTimes(70, 12, 21)).toBe('polar-night');
    expect(sunTimes(0, 3, 21)).toEqual(expect.objectContaining({ sunrise: expect.closeTo(6, 0), sunset: expect.closeTo(18, 0) }));
  });
});

describe('light levels', () => {
  it('fades from day to night through twilight', () => {
    expect(darkness(30)).toBe(0);
    expect(darkness(6)).toBe(0);
    expect(darkness(-12)).toBe(1);
    expect(darkness(-30)).toBe(1);
    expect(darkness(-3)).toBeGreaterThan(0.3);
    expect(darkness(-3)).toBeLessThan(0.7);
    expect(darkness(0)).toBeLessThan(darkness(-6));
  });
  it('has warm light only near the horizon', () => {
    expect(goldenHour(40)).toBe(0);
    expect(goldenHour(0)).toBe(1);
    expect(goldenHour(6)).toBeCloseTo(0.5, 9);
    expect(goldenHour(-10)).toBe(0);
  });
});

describe('shadows', () => {
  it('falls away from the sun, as long as the object is tall over the tangent of the elevation', () => {
    // sun due south at 45°, north up on the plan: the shadow of a 3 m pole points north (up on screen, -y), 3 m long
    const s = shadowOffset({ azimuth: 180, elevation: 45 }, 0, 3)!;
    expect(s.dx).toBeCloseTo(0, 9);
    expect(s.dy).toBeCloseTo(-3, 9);
    // sun in the east (90°) at 45°: shadow points west (-x)
    const e = shadowOffset({ azimuth: 90, elevation: 45 }, 0, 2)!;
    expect(e.dx).toBeCloseTo(-2, 9);
    expect(e.dy).toBeCloseTo(0, 9);
    // rotating the plan (north pointing to the right) turns the shadow with it
    const rotated = shadowOffset({ azimuth: 180, elevation: 45 }, 90, 3)!; // north is at screen "right", so south is left
    expect(rotated.dx).toBeCloseTo(3, 9); // shadow points north = right
    expect(rotated.dy).toBeCloseTo(0, 9);
    // lower sun, longer shadow
    expect(Math.hypot(...Object.values(shadowOffset({ azimuth: 180, elevation: 20 }, 0, 3)!))).toBeCloseTo(3 / Math.tan((20 * Math.PI) / 180), 6);
  });
  it('has no shadow when the sun is down or too low, and caps very long ones', () => {
    expect(shadowOffset({ azimuth: 180, elevation: -5 }, 0, 3)).toBeNull();
    expect(shadowOffset({ azimuth: 180, elevation: 1 }, 0, 3)).toBeNull();
    expect(shadowOffset({ azimuth: 180, elevation: 45 }, 0, 0)).toBeNull();
    const low = shadowOffset({ azimuth: 180, elevation: 2, }, 0, 30, 40)!;
    expect(Math.hypot(low.dx, low.dy)).toBeCloseTo(40, 9);
  });
});

describe('formatting', () => {
  it('formats hours and compass points', () => {
    expect(formatHour(14.5)).toBe('14:30');
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(23.999)).toBe('00:00');
    expect(formatHour(5.25)).toBe('05:15');
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(225)).toBe('SW');
    expect(compassPoint(350)).toBe('N');
  });
});
