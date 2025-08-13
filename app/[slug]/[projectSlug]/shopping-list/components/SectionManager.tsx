import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-gray-600 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            Manage Sections
            <Badge variant="secondary">{sections.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name (e.g. Kitchen, Bathroom)"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              />
              <Button 
                onClick={handleCreateSection} 
                disabled={isPending || !newSectionName.trim()}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>
            
            {sections.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Existing Sections:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sections.map((section) => (
                    <div key={section._id} className="flex items-center justify-between p-2 border rounded-md">
                      <span className="text-sm">{section.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSection(section._id)}
                        disabled={isPending}
                        className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}