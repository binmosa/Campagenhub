import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Avatar, Chip, SearchField } from '@heroui/react';
import { DataGrid } from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type Application = {
  id: string;
  status: string;
  pitch?: string;
  created_at?: string;
  creator?: {
    email?: string;
    creatorProfile?: { avatar_url?: string; follower_range?: string };
  };
  campaign?: { title?: string; brand?: { email?: string } };
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  declined: 'danger',
  refunded: 'warning',
};

const formatNum = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : String(n);

const getFollowers = (user: any): string => {
  const fr: string = user?.creatorProfile?.follower_range || '';
  const num = parseInt(fr, 10);
  if (!isNaN(num) && num.toString() === fr.trim()) return formatNum(num);
  if (fr.includes('500k')) return '500k+';
  if (fr.includes('100k')) return '100k-500k';
  if (fr.includes('50k')) return '50k-100k';
  if (fr.includes('10k')) return '10k-50k';
  return '1k-10k';
};

const AdminApplications: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/admin/applications')
      .then((res) => {
        setApplications(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      applications.filter(
        (a) =>
          (a.creator?.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (a.campaign?.title || '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          a.status.toLowerCase().includes(search.toLowerCase())
      ),
    [applications, search]
  );

  const columns: DataGridColumn<Application>[] = [
    {
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const initial = (item.creator?.email || 'C')[0].toUpperCase();
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              {item.creator?.creatorProfile?.avatar_url && (
                <Avatar.Image
                  src={item.creator.creatorProfile.avatar_url}
                  alt={item.creator.email}
                />
              )}
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
            <span className="text-foreground text-sm font-medium truncate">
              {item.creator?.email || 'N/A'}
            </span>
          </div>
        );
      },
      header: 'Creator',
      id: 'creator',
      isRowHeader: true,
      minWidth: 240,
    },
    {
      allowsResizing: true,
      cell: (item) => (
        <div className="flex flex-col min-w-0">
          <span className="text-foreground text-sm font-medium truncate">
            {item.campaign?.title || 'N/A'}
          </span>
          <span className="text-muted text-xs truncate">
            {item.campaign?.brand?.email || ''}
          </span>
        </div>
      ),
      header: 'Campaign',
      id: 'campaign',
      minWidth: 220,
    },
    {
      align: 'end',
      allowsResizing: true,
      cell: (item) => (
        <span className="text-muted text-sm tabular-nums">
          {getFollowers(item.creator)}
        </span>
      ),
      header: 'Followers',
      id: 'followers',
      minWidth: 120,
    },
    {
      accessorKey: 'pitch',
      allowsResizing: true,
      cell: (item) => (
        <span className="text-muted text-sm line-clamp-1">
          {item.pitch || 'N/A'}
        </span>
      ),
      header: 'Pitch',
      id: 'pitch',
      minWidth: 220,
    },
    {
      accessorKey: 'status',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <Chip
          color={STATUS_COLOR[item.status] || 'default'}
          size="sm"
          variant="soft"
        >
          <Chip.Label className="capitalize">{item.status}</Chip.Label>
        </Chip>
      ),
      header: 'Status',
      id: 'status',
      minWidth: 120,
    },
    {
      accessorKey: 'created_at',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="text-muted text-sm tabular-nums">
          {item.created_at
            ? new Date(item.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </span>
      ),
      header: 'Applied',
      id: 'created_at',
      minWidth: 130,
    },
  ];

  return (
    <PageShell
      title="All Applications"
      description="Monitor all creator applications across campaigns."
      icon={<FileText size={18} />}
    >
      <div className="flex justify-end">
        <SearchField
          aria-label="Search applications"
          value={search}
          onChange={setSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-full sm:w-[280px]"
              placeholder="Search by creator, campaign, or status…"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <DataGrid
          allowsColumnResize
          aria-label="Applications"
          columns={columns}
          contentClassName="min-w-[1100px]"
          data={filtered}
          defaultSortDescriptor={{
            column: 'created_at',
            direction: 'descending',
          }}
          getRowId={(item) => item.id}
          renderEmptyState={() => 'No applications found.'}
          selectionMode="none"
          variant="primary"
        />
      )}
    </PageShell>
  );
};

export default AdminApplications;
