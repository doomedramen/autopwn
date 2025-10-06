import StatsCards from '@/components/StatsCards';
import JobQueue from '@/components/JobQueue';
import ResultsTable from '@/components/ResultsTable';
import DictionariesList from '@/components/DictionariesList';
import FileUpload from '@/components/FileUpload';
import WordlistGenerator from '@/components/WordlistGenerator';
import Captures from '@/components/Captures';

export default function Home() {
  return (
    <div className="space-y-6">
      <StatsCards />

      <FileUpload />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Captures />
        <div className="space-y-6">
          <DictionariesList />
          <WordlistGenerator />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <JobQueue />
      </div>

      <ResultsTable />
    </div>
  );
}
