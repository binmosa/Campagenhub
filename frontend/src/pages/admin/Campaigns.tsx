import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Eye, EyeOff } from 'lucide-react';
import { Avatar, Button, Chip, SearchField } from '@heroui/react';
import { DataGrid } from '@heroui-pro/react';
import type { DataGridColumn } from '@heroui-pro/react';
import api from '../../lib/api';
import { PageShell } from '../../components/ui';

type Campaign = {
  id: string;
  title: string;
  platform?: string;
  budget?: number | string;
  status: string;
  created_at?: string;
  brand?: { email?: string; brandProfile?: { logo_url?: string } };
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  inactive: 'default',
  draft: 'warning',
  closed: 'danger',
};

const AdminCampaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .get('/admin/campaigns')
      .then((res) => {
        setCampaigns(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/campaigns/${id}/status`, { status: newStatus });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    } catch {
      alert('Failed to update campaign status');
    }
  };

  const filtered = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          (c.brand?.email || '').toLowerCase().includes(search.toLowerCase())
      ),
    [campaigns, search]
  );

  const columns: DataGridColumn<Campaign>[] = [
    {
      accessorKey: 'title',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <div className="flex flex-col min-w-0">
          <span className="text-foreground text-sm font-medium truncate">
            {item.title}
          </span>
          <span className="text-muted text-xs truncate">
            {item.platform || 'N/A'}
          </span>
        </div>
      ),
      header: 'Campaign',
      id: 'title',
      isRowHeader: true,
      minWidth: 220,
    },
    {
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => {
        const initial = (item.brand?.email || 'B')[0].toUpperCase();
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              {item.brand?.brandProfile?.logo_url && (
                <Avatar.Image
                  src={item.brand.brandProfile.logo_url}
                  alt={item.brand.email}
                />
              )}
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
            <span className="text-foreground text-sm truncate">
              {item.brand?.email || 'N/A'}
            </span>
          </div>
        );
      },
      header: 'Brand',
      id: 'brand',
      minWidth: 220,
    },
    {
      accessorKey: 'budget',
      align: 'end',
      allowsResizing: true,
      allowsSorting: true,
      cell: (item) => (
        <span className="font-medium text-foreground tabular-nums">
          ${Number(item.budget || 0).toLocaleString()}
        </span>
      ),
      header: 'Budget',
      id: 'budget',
      minWidth: 120,
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
      header: 'Created',
      id: 'created_at',
      minWidth: 130,
    },
    {
      align: 'end',
      allowsResizing: false,
      cell: (item) => (
        <Button
          variant={item.status === 'active' ? 'tertiary' : 'primary'}
          size="sm"
          onPress={() => handleToggle(item.id, item.status)}
        >
          {item.status === 'active' ? (
            <>
              <EyeOff className="size-3" /> Unpublish
            </>
          ) : (
            <>
              <Eye className="size-3" /> Publish
            </>
          )}
        </Button>
      ),
      header: '',
      id: 'actions',
      minWidth: 140,
      pinned: 'end',
    },
  ];

  return (
    <PageShell
      title="All Campaigns"
      description="Oversee and manage all platform campaigns."
      icon={<Briefcase size={18} />}
    >
      <div className="flex justify-end">
        <SearchField
          aria-label="Search campaigns"
          value={search}
          onChange={setSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-full sm:w-[260px]"
              placeholder="Search by title or brand…"
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
          aria-label="Campaigns"
          columns={columns}
          contentClassName="min-w-[1200px]"
          data={filtered}
          defaultSortDescriptor={{
            column: 'created_at',
            direction: 'descending',
          }}
          getRowId={(item) => item.id}
          renderEmptyState={() => 'No campaigns found.'}
          selectionMode="none"
          variant="primary"
        />
      )}
    </PageShell>
  );
};

export default AdminCampaigns;
