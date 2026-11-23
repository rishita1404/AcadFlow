import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import {
  CalendarDays,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  HeartPulse,
  Briefcase,
  ShieldCheck,
} from 'lucide-react';

export default function StudentLeave() {
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState('medical');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => leaveApi.getMyRequests().then((res) => res.data),
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => leaveApi.submit(payload),
    onSuccess: () => {
      setFormSuccess('Leave request submitted successfully for mentor review.');
      setFormError('');
      setReason('');
      setDateFrom('');
      setDateTo('');
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail?.message || 'Failed to submit leave request.';
      setFormError(msg);
      setFormSuccess('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!dateFrom || !dateTo) {
      setFormError('Please select both start and end dates.');
      return;
    }
    if (dateFrom > dateTo) {
      setFormError('Start date cannot be after end date.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please provide a supportive reason for your absence.');
      return;
    }

    submitMutation.mutate({
      type: leaveType,
      date_from: dateFrom,
      date_to: dateTo,
      reason: reason.trim(),
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending review
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-indigo-600" />
          My Leave & Attendance Excusal
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit formal leave for illness or sanctioned duty. Once approved by your mentor, sessions in this range are excused from calculations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              New Leave Request
            </h2>

            {formSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Leave Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('medical')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      leaveType === 'medical'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <HeartPulse className="w-4 h-4" />
                    Medical
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('duty')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      leaveType === 'duty'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Duty / Event
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason (text explanation)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Explain reason for absence (e.g. viral fever, medical rest, university hackathon)..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  No document upload required. Your mentor will evaluate the reason.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Approved leaves are purely neutral: excused sessions reduce both held and total counts, preserving your attendance buffer without penalty.
              </span>
            </div>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Submitted Leave History</h2>
              <span className="text-xs text-slate-400">{requests.length} total</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">No leave requests found</p>
                <p className="text-xs text-slate-400 mt-1">Submit your first leave request using the form.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <div key={req.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {req.type === 'medical' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            <HeartPulse className="w-3 h-3" />
                            Medical
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            <Briefcase className="w-3 h-3" />
                            Duty
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-800">
                          {req.date_from} → {req.date_to}
                        </span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{req.reason}"
                    </p>

                    {req.decision_note && (
                      <div className="text-xs text-slate-700 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 space-y-1">
                        <div className="font-medium text-indigo-900 flex items-center justify-between">
                          <span>Decision Note from {req.decided_by_name || 'Reviewer'}:</span>
                          {req.decided_at && (
                            <span className="text-[11px] text-indigo-500 font-normal">
                              {new Date(req.decided_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-indigo-800">{req.decision_note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
