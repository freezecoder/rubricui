import Link from 'next/link';
import { HealthStatusIndicator } from '@/components/ui/health-status-indicator';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
      <div className="w-full px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent mb-4">
            Targetminer Rubrics
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
            Advanced genomics data analysis platform that enables researchers to create, 
            manage, and execute custom scoring rule sets and rubrics on large genomic datasets.
          </p>
          
          {/* API Health Status Indicator */}
          <div className="flex justify-center mb-8">
            <HealthStatusIndicator />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/run"
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Analysis
            </Link>
            <Link
              href="/projects"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/rules"
              className="bg-white hover:bg-gray-50 text-red-600 font-semibold py-3 px-6 rounded-lg border border-red-600 transition-colors"
            >
              View Rules
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Flexible Rule Creation</h3>
            <p className="text-gray-600">
              Build custom scoring algorithms for genomic data analysis with intuitive rule creation tools.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Rubric Composition</h3>
            <p className="text-gray-600">
              Combine multiple rules into reusable rubrics for comprehensive analysis workflows.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Scalable Processing</h3>
            <p className="text-gray-600">
              Handle datasets with ~20,000 genes and hundreds of columns efficiently.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Create Rules</h3>
              <p className="text-gray-600">
                Define individual scoring rules using conditional logic and column mappings.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Build Rubrics</h3>
              <p className="text-gray-600">
                Combine multiple rules into rubrics with customizable weights and ordering.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Upload Data</h3>
              <p className="text-gray-600">
                Import your genomic data in Excel format and validate the structure.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Run Analysis</h3>
              <p className="text-gray-600">
                Execute rules and rubrics on your data to generate ranked gene lists.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}