"use client";

import React, { useState } from "react";
import { useDictionaries, useMergeDictionaries } from "@/lib/api-hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Loader2, Plus, X } from "lucide-react";

interface MergeDictionariesModalProps {
  children: React.ReactNode;
}

export function MergeDictionariesModal({
  children,
}: MergeDictionariesModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedDictionaries, setSelectedDictionaries] = useState<Set<string>>(
    new Set(),
  );
  const [removeDuplicates, setRemoveDuplicates] = useState(true);

  const { data: dictionariesData } = useDictionaries();
  const mergeMutation = useMergeDictionaries();

  const handleToggleDictionary = (id: string) => {
    const newSelected = new Set(selectedDictionaries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else if (newSelected.size < 10) {
      newSelected.add(id);
    }
    setSelectedDictionaries(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedDictionaries.size < 2 || !name.trim()) {
      return;
    }

    try {
      await mergeMutation.mutateAsync({
        name: name.trim(),
        dictionaryIds: Array.from(selectedDictionaries),
        removeDuplicates,
      });
      setOpen(false);
      setName("");
      setSelectedDictionaries(new Set());
      setRemoveDuplicates(true);
    } catch (error) {
      console.error("Failed to merge dictionaries:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div onClick={() => setOpen(true)}>{children}</div>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto font-mono">
        <DialogHeader>
          <DialogTitle>Merge Dictionaries</DialogTitle>
          <DialogDescription>
            Combine multiple dictionaries into one. You can merge up to 10
            dictionaries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="name">Dictionary Name *</Label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dictionary name"
              className="mt-2 w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>

          <div>
            <Label>Select Dictionaries (2-10 required) *</Label>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
              {dictionariesData?.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  no dictionaries available
                </p>
              ) : (
                dictionariesData?.data.map((dictionary: any) => (
                  <div
                    key={dictionary.id}
                    className={`flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-muted ${
                      selectedDictionaries.has(dictionary.id)
                        ? "bg-muted/50"
                        : ""
                    }`}
                    onClick={() => handleToggleDictionary(dictionary.id)}
                  >
                    <Checkbox
                      id={`dict-${dictionary.id}`}
                      checked={selectedDictionaries.has(dictionary.id)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`dict-${dictionary.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {dictionary.name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {dictionary.wordCount?.toLocaleString() || 0} words ·{" "}
                        {dictionary.type}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {selectedDictionaries.size > 0 && selectedDictionaries.size < 2 && (
              <p className="text-sm text-destructive mt-2">
                select at least 2 dictionaries
              </p>
            )}
            {selectedDictionaries.size >= 10 && (
              <p className="text-sm text-destructive mt-2">
                maximum 10 dictionaries allowed
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remove-duplicates"
              checked={removeDuplicates}
              onCheckedChange={(checked) =>
                setRemoveDuplicates(checked as boolean)
              }
            />
            <Label htmlFor="remove-duplicates" className="cursor-pointer">
              Remove duplicates
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !name.trim() ||
              selectedDictionaries.size < 2 ||
              selectedDictionaries.size > 10 ||
              mergeMutation.isPending
            }
          >
            {mergeMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Merging...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Merge Dictionaries
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
