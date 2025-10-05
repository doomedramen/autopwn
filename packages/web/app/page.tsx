import StatsCards from '@/components/StatsCards';
import JobQueue from '@/components/JobQueue';
import ResultsTable from '@/components/ResultsTable';
import DictionariesList from '@/components/DictionariesList';
import FileUpload from '@/components/FileUpload';
import WordlistGenerator from '@/components/WordlistGenerator';

export default function Home() {
  return (
    <div className="space-y-6">
      <StatsCards />

      <FileUpload />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <JobQueue />
        </div>
        <div className="space-y-6">
          <DictionariesList />
          <WordlistGenerator />
        </div>
      </div>

      <ResultsTable />
    </div>
  );
}
