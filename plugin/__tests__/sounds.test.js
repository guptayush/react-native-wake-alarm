const { describe, expect, it } = require('@jest/globals');
const { classifySounds } = require('../lib/sounds');

describe('classifySounds', () => {
  it('routes by extension and rejects bad Android resource names', () => {
    expect(
      classifySounds([
        'chime.mp3',
        'chime.caf',
        'Soft-Bell.wav',
        'notes.txt',
        'ok_2.wav',
      ])
    ).toEqual({
      android: ['chime.mp3', 'ok_2.wav'],
      ios: ['chime.caf', 'Soft-Bell.wav', 'ok_2.wav'],
      rejected: ['Soft-Bell.wav'],
    });
  });
  it('skips files with no extension and dotfiles', () => {
    expect(classifySounds(['README', '.DS_Store', 'chime.mp3'])).toEqual({
      android: ['chime.mp3'],
      ios: [],
      rejected: [],
    });
  });
});
