
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Download, Eye, FileText } from "lucide-react";
import Header from "@/components/layout/Header";
import { Link } from "react-router-dom";

interface ReportFile {
  id: string;
  name: string;
  uploadedAt: string;
  completedAt: string;
  segments: number;
  errors: number;
  score: number;
  status: "completed" | "error";
  language: string;
}

const Reports = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");

  const reports: ReportFile[] = [
    {
      id: "1",
      name: "product_catalog_en_de.xliff",
      uploadedAt: "2024-01-15T10:30:00Z",
      completedAt: "2024-01-15T10:35:00Z",
      segments: 245,
      errors: 8,
      score: 8.9,
      status: "completed",
      language: "EN → DE",
    },
    {
      id: "2",
      name: "marketing_copy_es_en.mxliff",
      uploadedAt: "2024-01-14T16:45:00Z",
      completedAt: "2024-01-14T16:50:00Z",
      segments: 123,
      errors: 3,
      score: 9.2,
      status: "completed",
      language: "ES → EN",
    },
    {
      id: "3",
      name: "legal_docs_de_en.xliff",
      uploadedAt: "2024-01-14T14:20:00Z",
      completedAt: "2024-01-14T14:28:00Z",
      segments: 789,
      errors: 23,
      score: 7.8,
      status: "completed",
      language: "DE → EN",
    },
    {
      id: "4",
      name: "technical_manual_fr_en.xliff",
      uploadedAt: "2024-01-13T11:15:00Z",
      completedAt: "2024-01-13T11:22:00Z",
      segments: 456,
      errors: 12,
      score: 8.3,
      status: "completed",
      language: "FR → EN",
    },
    {
      id: "5",
      name: "website_content_it_en.xliff",
      uploadedAt: "2024-01-12T09:30:00Z",
      completedAt: "2024-01-12T09:38:00Z",
      segments: 334,
      errors: 15,
      score: 8.0,
      status: "completed",
      language: "IT → EN",
    },
  ];

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    const matchesLanguage = languageFilter === "all" || report.language === languageFilter;
    
    return matchesSearch && matchesStatus && matchesLanguage;
  });

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-green-600 bg-green-50";
    if (score >= 7) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const languages = Array.from(new Set(reports.map(r => r.language)));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
            <p className="text-gray-600">
              View and manage all your completed quality assessment reports
            </p>
          </div>
          <Link to="/upload">
            <Button>Upload New File</Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Assessment Reports</CardTitle>
            <CardDescription>
              {filteredReports.length} of {reports.length} reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Segments</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{report.name}</p>
                          <p className="text-sm text-gray-500">
                            Uploaded {formatDate(report.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.language}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {report.segments.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-red-600">
                        {report.errors}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreColor(report.score)}`}>
                        {report.score}/10
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(report.completedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link to={`/report/${report.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredReports.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No reports found matching your criteria</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
