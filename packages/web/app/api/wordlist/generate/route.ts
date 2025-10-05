import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { addDictionary } from '@/lib/db';

const DICTIONARIES_PATH = process.env.DICTIONARIES_PATH || '/app/volumes/dictionaries';

interface GenerateRequest {
  baseWords: string[];
  includeNumbers: boolean;
  includeSpecialChars: boolean;
  includeCaps: boolean;
  minLength: number;
  maxLength: number;
  customPattern?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { baseWords, includeNumbers, includeSpecialChars, includeCaps, minLength, maxLength, customPattern } = body;

    if (!baseWords || baseWords.length === 0) {
      return NextResponse.json({ error: 'No base words provided' }, { status: 400 });
    }

    const wordlist = new Set<string>();

    // Helper functions
    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    const allCaps = (str: string) => str.toUpperCase();
    const leetSpeak = (str: string) => str.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5');

    // Number variations
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '01', '10', '11', '12', '123', '1234', '2023', '2024', '2025'];

    // Special character variations
    const specialChars = ['!', '@', '#', '$', '%', '*', '!@', '@#', '!!', '@@'];

    // Years
    const years = ['2020', '2021', '2022', '2023', '2024', '2025'];

    for (const baseWord of baseWords) {
      const word = baseWord.trim();
      if (!word) continue;

      // Add base word
      if (word.length >= minLength && word.length <= maxLength) {
        wordlist.add(word);
      }

      // Capitalization variations
      if (includeCaps) {
        const capWord = capitalize(word);
        const upperWord = allCaps(word);
        if (capWord.length >= minLength && capWord.length <= maxLength) {
          wordlist.add(capWord);
        }
        if (upperWord.length >= minLength && upperWord.length <= maxLength) {
          wordlist.add(upperWord);
        }
      }

      // Leet speak
      const leetWord = leetSpeak(word);
      if (leetWord !== word && leetWord.length >= minLength && leetWord.length <= maxLength) {
        wordlist.add(leetWord);
      }

      // With numbers
      if (includeNumbers) {
        for (const num of numbers) {
          const combo = word + num;
          if (combo.length >= minLength && combo.length <= maxLength) {
            wordlist.add(combo);
          }
          if (includeCaps) {
            const capCombo = capitalize(word) + num;
            if (capCombo.length >= minLength && capCombo.length <= maxLength) {
              wordlist.add(capCombo);
            }
          }
        }
      }

      // With special chars
      if (includeSpecialChars) {
        for (const special of specialChars) {
          const combo = word + special;
          if (combo.length >= minLength && combo.length <= maxLength) {
            wordlist.add(combo);
          }
          if (includeCaps) {
            const capCombo = capitalize(word) + special;
            if (capCombo.length >= minLength && capCombo.length <= maxLength) {
              wordlist.add(capCombo);
            }
          }
        }
      }

      // Numbers + special chars
      if (includeNumbers && includeSpecialChars) {
        for (const num of numbers.slice(0, 5)) {
          for (const special of specialChars.slice(0, 3)) {
            const combo = word + num + special;
            if (combo.length >= minLength && combo.length <= maxLength) {
              wordlist.add(combo);
            }
          }
        }
      }

      // Years
      for (const year of years) {
        const combo = word + year;
        if (combo.length >= minLength && combo.length <= maxLength) {
          wordlist.add(combo);
        }
        if (includeCaps) {
          const capCombo = capitalize(word) + year;
          if (capCombo.length >= minLength && capCombo.length <= maxLength) {
            wordlist.add(capCombo);
          }
        }
      }

      // Custom pattern
      if (customPattern) {
        let generated = customPattern;
        generated = generated.replace(/\{word\}/g, word);

        if (generated.includes('{number}')) {
          for (const num of numbers.slice(0, 10)) {
            const patternWord = generated.replace(/\{number\}/g, num);
            if (patternWord.length >= minLength && patternWord.length <= maxLength) {
              wordlist.add(patternWord);
            }
          }
        } else if (generated.includes('{year}')) {
          for (const year of years) {
            const patternWord = generated.replace(/\{year\}/g, year);
            if (patternWord.length >= minLength && patternWord.length <= maxLength) {
              wordlist.add(patternWord);
            }
          }
        } else {
          if (generated.length >= minLength && generated.length <= maxLength) {
            wordlist.add(generated);
          }
        }
      }
    }

    // Convert to array and sort
    const wordlistArray = Array.from(wordlist).sort();

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `custom-${timestamp}-${wordlistArray.length}.txt`;
    const filePath = path.join(DICTIONARIES_PATH, filename);

    // Write to file
    const content = wordlistArray.join('\n') + '\n';
    await fs.writeFile(filePath, content, 'utf-8');

    // Get file size and add to database
    const stats = await fs.stat(filePath);
    addDictionary(filename, filePath, stats.size);

    return NextResponse.json({
      filename,
      count: wordlistArray.length,
    });
  } catch (error) {
    console.error('Error generating wordlist:', error);
    return NextResponse.json(
      { error: 'Failed to generate wordlist' },
      { status: 500 }
    );
  }
}
