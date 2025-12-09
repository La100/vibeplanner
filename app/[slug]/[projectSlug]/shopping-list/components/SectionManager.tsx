import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';

interface SectionManagerProps {
  sections: Doc<"shoppingListSections">[];
  onCreateSection: (name: string) => Promise<void>;
  onDeleteSection: (sectionId: Id<"shoppingListSections">) => Promise<void>;
  isPending: boolean;
}

export function SectionManager({ 
  sections, 
  onCreateSection, 
  onDeleteSection, 
  isPending 
}: SectionManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;
    
    try {
      await onCreateSection(newSectionName.trim());
      setNewSectionName('');
    } catch (error) {
      console.error('Error creating section:', error);
    }
  };

  const handleDeleteSection = async (sectionId: Id<"shoppingListSections">) => {
    try {
      await onDeleteSection(sectionId);
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  return (
    <div className="mb-10 rounded-[32px] border border-[#E7E2D9] bg-white p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-4 cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-xl font-medium font-[var(--font-display-serif)] text-[#1A1A1A]">Manage Sections</h3>
          <span className="inline-flex items-center justify-center rounded-full bg-[#FAF7F2] border border-[#E7E2D9] px-3 py-1 text-xs font-medium text-[#3C3A37]">
            {sections.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-full hover:bg-[#FAF7F2]"
        >
          {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </Button>
      </div>
      {isExpanded && (
        <div className="mt-6 space-y-6">
          <div className="flex gap-3">
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Section name (e.g. Kitchen, Bathroom)"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              className="h-11 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
            />
            <Button 
              onClick={handleCreateSection} 
              disabled={isPending || !newSectionName.trim()}
              className="rounded-full bg-[#0E0E0E] px-6 h-11 text-white hover:bg-[#1F1F1F]"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
            
          {sections.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-[#8C8880] uppercase tracking-wider">Existing Sections</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sections.map((section) => (
                  <div key={section._id} className="flex items-center justify-between p-3 border border-[#E7E2D9] rounded-[16px] bg-[#FAF7F2]">
                    <span className="text-sm font-medium text-[#3C3A37]">{section.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSection(section._id)}
                      disabled={isPending}
                      className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 rounded-full"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
