'use client';

import { useState } from 'react';
import { useDictionaries } from '@/lib/api-hooks';
import { formatDate, formatFileSize, getStatusColor } from '@/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { UploadModal } from '@/components/upload-modal';
import { DictionaryGeneratorModal } from '@/components/dictionary-generator-modal';
import {
  BookOpen,
  FileText,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Zap,
  FolderOpen,
  Loader2
} from 'lucide-react';

interface DictionariesTabProps {
  className?: string;
}

export function DictionariesTab({ className }: DictionariesTabProps) {
  const { data: dictionariesData, isLoading, error, refetch } = useDictionaries();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'uploaded':
        return <FolderOpen className="h-4 w-4" />;
      case 'generated':
        return <Zap className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <h3 className="text-destructive font-medium mb-2">
            Error Loading Dictionaries
          </h3>
          <p className="text-muted-foreground mb-4">
            Failed to load dictionaries. Please try again.
          </p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between font-mono">
        <div></div>
        <div className="flex gap-2">
          <UploadModal defaultTab="dictionary">
            <Button variant="outline" className="font-mono text-sm">
              Upload Dictionary
            </Button>
          </UploadModal>
          <DictionaryGeneratorModal>
            <Button className="font-mono text-sm">
              Generate Dictionary
            </Button>
          </DictionaryGeneratorModal>
        </div>
      </div>

      {/* Dictionaries List */}
      <div className="bg-card rounded-lg shadow">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : dictionariesData?.data.length === 0 ? (
          <div className="text-center py-12 font-mono px-6">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              no dictionaries found
            </h3>
            <p className="text-muted-foreground mb-4">
              upload or generate dictionaries to get started
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Words
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
            <tbody className="bg-card divide-y">
              {dictionariesData?.data.map((dictionary) => (
                <tr key={dictionary.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium">
                        {dictionary.name}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {dictionary.filename}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center gap-1">
                      <span>{getTypeIcon(dictionary.type)}</span>
                      {dictionary.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center gap-1 ${getStatusColor(dictionary.status)}`}>
                      <span>{getStatusIcon(dictionary.status)}</span>
                      {dictionary.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatFileSize(dictionary.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {dictionary.wordCount ? dictionary.wordCount.toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(dictionary.createdAt)}
                  </td>
                </tr>
              ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}