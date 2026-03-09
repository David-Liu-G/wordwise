import { Word } from '../types';
import { wordsCet6AB } from './cet6-a-b';
import { wordsCet6CD } from './cet6-c-d';
import { wordsCet6EF } from './cet6-e-f';
import { wordsCet6GI } from './cet6-g-i';
import { wordsCet6JO } from './cet6-j-o';
import { wordsCet6PR } from './cet6-p-r';
import { wordsCet6ST } from './cet6-s-t';
import { wordsCet6UZ } from './cet6-u-z';

export const wordBank: Word[] = [
  ...wordsCet6AB,
  ...wordsCet6CD,
  ...wordsCet6EF,
  ...wordsCet6GI,
  ...wordsCet6JO,
  ...wordsCet6PR,
  ...wordsCet6ST,
  ...wordsCet6UZ,
];
