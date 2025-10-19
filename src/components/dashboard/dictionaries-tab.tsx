'use client';

import React from 'react';
import { formatFileSize } from '@/lib/utils/file-size';
import { formatNumber } from '@/lib/utils/format-number';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import { BookOpen, Upload } from 'lucide-react';
import { EmptyState, CardGridSkeleton } from '@/components/loading';

interface DictionaryInfo {
  id: string;
  name: string;
  originalName: string;
  lineCount: number;
  size: number;
  checksum: string;
  uploadDate: string;
  isCompressed: boolean;
}

interface DictionariesTabProps {
  dictionaries: DictionaryInfo[];
  isInitialLoad: boolean;
  onUploadClick: () => void;
}

export function DictionariesTab({
  dictionaries,
  isInitialLoad,
  onUploadClick,
}: DictionariesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Dictionaries</CardTitle>
        <CardDescription>
          Available password dictionaries for cracking jobs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoad ? (
          <CardGridSkeleton count={4} />
        ) : dictionaries.length > 0 ? (
          <ItemGroup className="gap-3">
            {dictionaries.map(dictionary => (
              <Item key={dictionary.id} variant="outline">
                <ItemMedia
                  variant="icon"
                  className="!self-center !translate-y-0"
                >
                  <BookOpen className="size-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{dictionary.name}</ItemTitle>
                  <ItemDescription>
                    {formatNumber(dictionary.lineCount)} •{' '}
                    {formatFileSize(dictionary.size)}
                    {dictionary.isCompressed && ' • Compressed'}
                    <br />
                    Uploaded{' '}
                    {new Date(dictionary.uploadDate).toLocaleDateString()}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline">Ready</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <EmptyState
            title="No dictionaries available"
            description="Upload password dictionary files to use in your cracking jobs. Supports various formats including compressed files."
            icon={<BookOpen className="h-12 w-12" />}
            action={
              <Button onClick={onUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Dictionary Files
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
