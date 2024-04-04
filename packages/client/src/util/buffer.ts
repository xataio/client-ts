function loadBuffer(): any {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer;
    }
  } catch {
    // ignore
    console.log('Buffer is not available, unable to load Buffer');
  }

  return undefined;
}

export const Buffer = loadBuffer();
