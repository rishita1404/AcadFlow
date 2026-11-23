import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import {
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HeartPulse,
  Briefcase,
  User,
  Filter,
  Check,
  X,
} from 'lucide-react';

export default function FacultyLeaveInbox() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('pending');
  const [activeModal, setActiveModal] = useState(null); // { req, action: 'approved' | 'rejected' }
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['faculty-leave-inbox', filterStatus],
    queryFn: () =>
      leaveApi
        .getInbox(filterStatus ? { status_filter: filterStatus } : {})
        .then((res) => res.data),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status, decision_note }) =>
      leaveApi.decide(id, { status, decision_note }),
    onSuccess: () => {
      setActiveModal(null);
      setDecisionNote('');
      setActionError('');
      queryClient.invalidateQueries({ queryKey: ['faculty-leave-inbox'] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail?.message ||
        'Failed to submit decision.';
      setActionError(msg);
    },
  });

  const handleOpenDecision = (req, action) => {
    setActiveModal({ req, action });
    setDecisionNote('');
    setActionError('');
  };

  const handleConfirmDecision = (e) => {
    e.preventDefault();
    if (!activeModal) return;
    decideMutation.mutate({
      id: activeModal.req.id,
      status: activeModal.action,
      decision_note: decisionNote.trim() || undefined,
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Inbox className="w-7 h-7 text-indigo-600" />
            Mentee Leave Inbox
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review formal medical and duty leave submissions from your assigned mentees.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 self-start sm:self-auto">
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-white text-indigo-700 font-semibold shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filterStatus === 'approved'
                ? 'bg-white text-emerald-700 font-semibold shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filterStatus === 'rejected'
                ? 'bg-white text-rose-700 font-semibold shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </button>
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              filterStatus === ''
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            All
          </button>
        </div>
      </div>

      {/* Requests Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading leave inbox...</div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No requests in this view</p>
            <p className="text-xs text-slate-400 mt-1">
              {filterStatus === 'pending'
                ? 'All pending leave requests have been processed.'
                : 'No requests matched the current filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => (
              <div key={req.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {req.student_name || `Student #${req.student_id}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Roll No: {req.student_roll_no || 'N/A'} • Submitted{' '}
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(req.status)}
                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDecision(req, 'approved')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenDecision(req, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Category</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {req.type === 'medical' ? (
                        <>
                          <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                          Medical Leave
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                          Duty / Event
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Date Span</span>
                    <span className="font-semibold text-slate-800">
                      {req.date_from} → {req.date_to}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block mb-0.5">Reason</span>
                    <span className="text-slate-700">{req.reason}</span>
                  </div>
                </div>

                {req.decision_note && (
                  <div className="text-xs bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 text-indigo-900">
                    <span className="font-semibold">Reviewer Note: </span>
                    {req.decision_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {activeModal.action === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h3>
            <p className="text-xs text-slate-500">
              Student: <span className="font-semibold text-slate-700">{activeModal.req.student_name}</span> (
              {activeModal.req.date_from} to {activeModal.req.date_to})
            </p>

            {actionError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Decision Note {activeModal.action === 'rejected' ? '(Required)' : '(Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    activeModal.action === 'approved'
                      ? 'e.g. Approved. Medical certificate noted and excused neutrally.'
                      : 'e.g. Insufficient documentation or prior notice provided.'
                  }
                  required={activeModal.action === 'rejected'}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decideMutation.isPending}
                  className={`px-4 py-2 rounded-lg text-white text-xs font-medium transition-colors ${
                    activeModal.action === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {decideMutation.isPending
                    ? 'Processing...'
                    : activeModal.action === 'approved'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
