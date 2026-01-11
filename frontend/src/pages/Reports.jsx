import { useState, useEffect } from 'react'
import { Calendar, Download, FileText, TrendingUp, Users, Clock, BarChart3 } from 'lucide-react'
import { PageLoader, ButtonLoader } from '../components/Loaders'
import SectionHeader from '../components/SectionHeader'
import KpiCard from '../components/KpiCard'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS } from '../utils/permissions'
import api from '../utils/api'

export default function Reports() {
  const { user, hasPermission } = useAuth()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [companies, setCompanies] = useState([])
  const [reportData, setReportData] = useState(null)
  const [filters, setFilters] = useState({
    start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    company_id: ''
  })
  
  const canViewAllCompanies = hasPermission(PERMISSIONS.VIEW_ALL_COMPANIES)

  useEffect(() => {
    fetchCompanies()
  }, [])

  useEffect(() => {
    if (companies.length > 0 || !canViewAllCompanies) {
      fetchReportData()
    }
  }, [filters, companies])

  const fetchCompanies = async () => {
    try {
      // Only fetch companies list for incubation_head
      if (canViewAllCompanies) {
        const response = await api.getCompanies()
        setCompanies(response.data)
      } else {
        // For company admins, auto-set their company and don't fetch list
        setCompanies([])
        setFilters(prev => ({ ...prev, company_id: user?.company_id || '' }))
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const fetchReportData = async () => {
    try {
      setLoading(true)
      // Use user's company_id if not incubation_head
      const companyId = canViewAllCompanies ? filters.company_id : user?.company_id
      const response = await api.getDailyReport(companyId, filters.start_date, filters.end_date)
      setReportData(response.data)
    } catch (error) {
      console.error('Error fetching report data:', error)
      alert('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format) => {
    try {
      setExporting(true)
      // Use user's company_id if not incubation_head
      const companyId = canViewAllCompanies ? filters.company_id : user?.company_id
      const blob = await api.exportAttendance(
        companyId, 
        filters.start_date,
        filters.end_date,
        format
      )
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `attendance-report-${filters.start_date}-${filters.end_date}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting report:', error)
      alert('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  if (loading && !reportData) return <PageLoader message="Loading reports..." />

  const stats = reportData?.summary || {
    total_scans: 0,
    unique_employees: 0,
    avg_attendance_rate: 0,
    peak_hour: 'N/A'
  }

  const chartData = reportData?.daily_stats || []

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Reports"
        subtitle="Generate attendance reports and analyze trends"
      />

      {/* Filters Card */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Filters</h3>
        <div className={`grid grid-cols-1 ${canViewAllCompanies ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="input w-full"
            />
          </div>
          {canViewAllCompanies && (
            <div>
              <label className="label">Company</label>
              <select
                value={filters.company_id}
                onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
                className="input w-full"
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="btn btn-secondary flex items-center space-x-2"
          >
            {exporting ? <ButtonLoader /> : <Download className="w-5 h-5" />}
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="btn btn-primary flex items-center space-x-2"
          >
            {exporting ? <ButtonLoader /> : <FileText className="w-5 h-5" />}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard title="Total Scans" value={stats.total_scans} icon={BarChart3} tone="blue" />
        <KpiCard title="Unique Employees" value={stats.unique_employees} icon={Users} tone="purple" />
        <KpiCard title="Avg Attendance" value={`${stats.avg_attendance_rate}%`} icon={TrendingUp} tone="green" />
        <KpiCard title="Peak Hour" value={stats.peak_hour} icon={Clock} tone="orange" />
      </div>

      {/* Daily Attendance Chart */}
      {chartData.length > 0 ? (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Attendance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MMM dd')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total_scans" 
                stroke="#4f46e5" 
                strokeWidth={2}
                name="Total Scans"
              />
              <Line 
                type="monotone" 
                dataKey="unique_employees" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Unique Employees"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No data available</h3>
          <p className="text-gray-500">Try adjusting your date range or filters</p>
        </div>
      )}

      {/* Hourly Distribution Chart */}
      {reportData?.hourly_distribution && reportData.hourly_distribution.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData.hourly_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#4f46e5" name="Scans" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Activity Table */}
      {reportData?.recent_logs && reportData.recent_logs.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.recent_logs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.employee_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.event_type === 'IN' 
                          ? 'bg-green-100 text-green-800' 
                          : log.event_type === 'OUT'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.event_type || 'SCAN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(log.recorded_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
