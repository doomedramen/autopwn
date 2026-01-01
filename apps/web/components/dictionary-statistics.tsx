"use client";

import { useDictionaryStatistics } from "@/lib/api-hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { BarChart3 } from "lucide-react";

interface DictionaryStatisticsProps {
  dictionaryId: string;
  dictionaryName: string;
  children: React.ReactNode;
}

export function DictionaryStatistics({
  dictionaryId,
  dictionaryName,
  children,
}: DictionaryStatisticsProps) {
  const {
    data: stats,
    isLoading,
    error,
  } = useDictionaryStatistics(dictionaryId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div>{children}</div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dictionary Statistics
          </DialogTitle>
          <DialogDescription>{dictionaryName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            failed to load statistics
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Words</p>
                  <p className="text-2xl font-bold">
                    {stats.basic?.wordCount?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Unique Words</p>
                  <p className="text-2xl font-bold">
                    {stats.basic?.uniqueWords?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Average Length
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.basic?.averageLength || 0} chars
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Length Range</p>
                  <p className="text-2xl font-bold">
                    {stats.basic?.minLength || 0}-{stats.basic?.maxLength || 0}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">File Size</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Bytes</p>
                  <p className="text-xl font-bold">
                    {stats.size?.bytes?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Kilobytes</p>
                  <p className="text-xl font-bold">
                    {stats.size?.kilobytes?.toLocaleString() || 0} KB
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Megabytes</p>
                  <p className="text-xl font-bold">
                    {stats.size?.megabytes?.toLocaleString() || 0} MB
                  </p>
                </div>
              </div>
              <div className="mt-4 border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Average per Word
                </p>
                <p className="text-xl font-bold">
                  {stats.size?.bytesPerWord || 0} bytes
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Frequency Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Shannon Entropy
                  </p>
                  <p className="text-3xl font-bold">
                    {stats.frequency?.entropy || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Higher values indicate more diverse passwords
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Duplicate Rate
                  </p>
                  <p className="text-3xl font-bold">
                    {stats.basic?.wordCount && stats.basic?.uniqueWords
                      ? (
                          ((stats.basic.wordCount - stats.basic.uniqueWords) /
                            stats.basic.wordCount) *
                          100
                        ).toFixed(2)
                      : "0.00"}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Lower is better
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Top 20 Words
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {stats.frequency?.topWords?.length ? (
                      stats.frequency.topWords.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.word}</span>
                          <span className="text-muted-foreground">
                            {item.count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        no data available
                      </p>
                    )}
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Length Distribution
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {stats.frequency?.lengthDistribution?.length ? (
                      stats.frequency.lengthDistribution.map(
                        (item: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.length} chars</span>
                            <span className="text-muted-foreground">
                              {item.count}
                            </span>
                          </div>
                        ),
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        no data available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {stats.metadata && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Processing Metadata
                </h3>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(stats.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
