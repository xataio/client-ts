import { describe, expect, test } from 'vitest';
import { buildTransformString, transformImage } from './transformations';

describe('transformImage', () => {
  test('should return undefined if url is undefined', () => {
    expect(transformImage(undefined)).toBe(undefined);
  });

  test('should throw if url is not valid', () => {
    expect(() => transformImage('not-valid')).toThrow();
  });

  test('should add one transformation', () => {
    const url = 'https://us-west-2.storage.xata.sh/ahkrvn63pl2hv4k4305oru19eg';
    const result = transformImage(url, { rotate: 90 });
    expect(result).toBe(
      `https://us-west-2.storage.xata.sh/transform/${buildTransformString([{ rotate: 90 }])}/ahkrvn63pl2hv4k4305oru19eg`
    );
  });

  test('should add multiple transformations', () => {
    const url = 'https://us-west-2.storage.xata.sh/ahkrvn63pl2hv4k4305oru19eg';
    const result = transformImage(url, { rotate: 90 }, { width: 100 });
    expect(result).toBe(
      `https://us-west-2.storage.xata.sh/transform/${buildTransformString([
        { rotate: 90 },
        { width: 100 }
      ])}/ahkrvn63pl2hv4k4305oru19eg`
    );
  });

  test('should add multiple transformations with search params', () => {
    const url =
      'https://us-west-2.xata.sh/file/00pmgob56lh0ol8p4vitsjugn0ametv2bqihop7et5mn8mp9apq8ee2401ietqbmglflg9evo7vu8l39nvec7ja53u98860bhns2it4ub8e8cpusteqclcn69ppadictfoqtibiqekvferia2vihpv78so?verify=mrkusp0000000vd3i4bgi51glgk73f33g2uvibuc35kqne5ckiohoflsekv56f0r';
    const result = transformImage(url, { rotate: 90 }, { width: 100 });
    expect(result).toBe(
      `https://us-west-2.xata.sh/transform/${buildTransformString([
        { rotate: 90 },
        { width: 100 }
      ])}/file/00pmgob56lh0ol8p4vitsjugn0ametv2bqihop7et5mn8mp9apq8ee2401ietqbmglflg9evo7vu8l39nvec7ja53u98860bhns2it4ub8e8cpusteqclcn69ppadictfoqtibiqekvferia2vihpv78so?verify=mrkusp0000000vd3i4bgi51glgk73f33g2uvibuc35kqne5ckiohoflsekv56f0r`
    );
  });

  test('should merge previous transformations with new ones', () => {
    const url = 'https://us-west-2.storage.xata.sh/transform/rotate=90/ahkrvn63pl2hv4k4305oru19eg';
    const result = transformImage(url, { width: 100 });
    expect(result).toBe(
      `https://us-west-2.storage.xata.sh/transform/${buildTransformString([
        { rotate: 90 },
        { width: 100 }
      ])}/ahkrvn63pl2hv4k4305oru19eg`
    );
  });
});
