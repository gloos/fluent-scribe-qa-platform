import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { type FilterState } from "@/hooks/useReportFilters";

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onReset: () => void;
  children: React.ReactNode;
  
  // Additional props for enhanced filtering
  availableLanguages?: string[];
  availableModels?: string[];
  availableFileTypes?: string[];
}

export function AdvancedFilters({ 
  filters, 
  onFiltersChange, 
  onReset, 
  children,
  availableLanguages = [],
  availableModels = [],
  availableFileTypes = []
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleResetFilters = () => {
    onReset();
    setLocalFilters({
      timeRange: '7d',
      reportType: 'all',
      languageFilter: 'all',
      scoreRange: [0, 10],
      dateRange: { from: null, to: null },
      fileSize: 'all',
      processingTimeRange: [0, 60],
      status: ['processing', 'completed', 'failed', 'pending'],
      errorRange: [0, 1000],
      segmentRange: [0, 10000],
      modelFilter: 'all',
      fileSizeRange: [0, 100],
      searchTerm: '',
    });
    setIsOpen(false);
  };

  const updateLocalFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const statusOptions = [
    { id: 'processing', label: 'Processing' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'pending', label: 'Pending' },
  ];

  const fileSizeOptions = [
    { value: 'all', label: 'All Sizes' },
    { value: 'small', label: 'Small (< 2MB)' },
    { value: 'medium', label: 'Medium (2-5MB)' },
    { value: 'large', label: 'Large (> 5MB)' },
  ];

  // Count active advanced filters
  const activeFiltersCount = [
    localFilters.scoreRange[0] !== 0 || localFilters.scoreRange[1] !== 10,
    localFilters.errorRange[0] !== 0 || localFilters.errorRange[1] !== 1000,
    localFilters.segmentRange[0] !== 0 || localFilters.segmentRange[1] !== 10000,
    localFilters.dateRange.from !== null || localFilters.dateRange.to !== null,
    localFilters.fileSize !== 'all',
    localFilters.fileSizeRange[0] !== 0 || localFilters.fileSizeRange[1] !== 100,
    localFilters.processingTimeRange[0] !== 0 || localFilters.processingTimeRange[1] !== 60,
    localFilters.status.length !== 4,
    localFilters.modelFilter !== 'all',
    localFilters.searchTerm.trim() !== '',
  ].filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="relative">
          {children}
          {activeFiltersCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </DialogTitle>
          <DialogDescription>
            Apply comprehensive filters to refine your dashboard data
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Search Term */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by filename, language, or model..."
                value={localFilters.searchTerm}
                onChange={(e) => updateLocalFilter('searchTerm', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Quality Score Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quality Score Range</Label>
            <div className="px-3">
              <Slider
                min={0}
                max={10}
                step={0.1}
                value={localFilters.scoreRange}
                onValueChange={(value) => updateLocalFilter('scoreRange', value as [number, number])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{localFilters.scoreRange[0]}</span>
                <span>{localFilters.scoreRange[1]}</span>
              </div>
            </div>
          </div>

          {/* Error Count Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Error Count Range</Label>
            <div className="px-3">
              <Slider
                min={0}
                max={1000}
                step={1}
                value={localFilters.errorRange}
                onValueChange={(value) => updateLocalFilter('errorRange', value as [number, number])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{localFilters.errorRange[0]}</span>
                <span>{localFilters.errorRange[1]}</span>
              </div>
            </div>
          </div>

          {/* Segment Count Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Segment Count Range</Label>
            <div className="px-3">
              <Slider
                min={0}
                max={10000}
                step={10}
                value={localFilters.segmentRange}
                onValueChange={(value) => updateLocalFilter('segmentRange', value as [number, number])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{localFilters.segmentRange[0]}</span>
                <span>{localFilters.segmentRange[1]}</span>
              </div>
            </div>
          </div>

          {/* File Size Range (MB) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Size Range (MB)</Label>
            <div className="px-3">
              <Slider
                min={0}
                max={100}
                step={0.1}
                value={localFilters.fileSizeRange}
                onValueChange={(value) => updateLocalFilter('fileSizeRange', value as [number, number])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{localFilters.fileSizeRange[0]} MB</span>
                <span>{localFilters.fileSizeRange[1]} MB</span>
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Custom Date Range</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !localFilters.dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange.from ? (
                      format(localFilters.dateRange.from, "PPP")
                    ) : (
                      "From date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateRange.from || undefined}
                    onSelect={(date) => 
                      updateLocalFilter('dateRange', { 
                        ...localFilters.dateRange, 
                        from: date || null 
                      })
                    }
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !localFilters.dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange.to ? (
                      format(localFilters.dateRange.to, "PPP")
                    ) : (
                      "To date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateRange.to || undefined}
                    onSelect={(date) => 
                      updateLocalFilter('dateRange', { 
                        ...localFilters.dateRange, 
                        to: date || null 
                      })
                    }
                    disabled={(date) =>
                      date > new Date() || 
                      date < new Date("1900-01-01") ||
                      (localFilters.dateRange.from && date < localFilters.dateRange.from)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* File Type Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Type</Label>
            <Select
              value={localFilters.reportType}
              onValueChange={(value) => updateLocalFilter('reportType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableFileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Language</Label>
            <Select
              value={localFilters.languageFilter}
              onValueChange={(value) => updateLocalFilter('languageFilter', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {availableLanguages.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">AI Model</Label>
            <Select
              value={localFilters.modelFilter}
              onValueChange={(value) => updateLocalFilter('modelFilter', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Size Categories */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Size Category</Label>
            <Select
              value={localFilters.fileSize}
              onValueChange={(value) => updateLocalFilter('fileSize', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select file size" />
              </SelectTrigger>
              <SelectContent>
                {fileSizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Processing Time Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Processing Time Range (minutes)</Label>
            <div className="px-3">
              <Slider
                min={0}
                max={60}
                step={1}
                value={localFilters.processingTimeRange}
                onValueChange={(value) => updateLocalFilter('processingTimeRange', value as [number, number])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>{localFilters.processingTimeRange[0]} min</span>
                <span>{localFilters.processingTimeRange[1]} min</span>
              </div>
            </div>
          </div>

          {/* File Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">File Status</Label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((status) => (
                <div key={status.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={status.id}
                    checked={localFilters.status.includes(status.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateLocalFilter('status', [...localFilters.status, status.id]);
                      } else {
                        updateLocalFilter('status', localFilters.status.filter(s => s !== status.id));
                      }
                    }}
                  />
                  <Label htmlFor={status.id} className="text-sm">
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleResetFilters}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <Button onClick={handleApplyFilters}>
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 