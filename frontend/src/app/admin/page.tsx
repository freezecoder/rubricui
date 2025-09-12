'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Users, 
  Shield, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle,
  Database,
  BarChart3,
  UserPlus,
  AlertTriangle,
  LogOut
} from 'lucide-react';

interface AdminStats {
  total_rules: number;
  total_rubrics: number;
  total_datasets: number;
  total_users: number;
  public_rules: number;
  private_rules: number;
  hidden_rules: number;
  enabled_rules: number;
  disabled_rules: number;
}

interface EntityItem {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'hidden';
  enabled: boolean;
  is_active: boolean;
  created_date: string;
  modified_date: string;
  owner_name?: string;
  organization?: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rules, setRules] = useState<EntityItem[]>([]);
  const [rubrics, setRubrics] = useState<EntityItem[]>([]);
  const [datasets, setDatasets] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('admin_token');
    const userData = localStorage.getItem('admin_user');
    
    if (!token || !userData) {
      router.push('/admin/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
      setUser(parsedUser);
      loadAdminData();
    } catch (error) {
      router.push('/admin/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('admin_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      // Load all entities with admin view
      const [rulesRes, rubricsRes, datasetsRes] = await Promise.all([
        fetch('http://localhost:8000/api/rules?admin_view=true&limit=1000', { headers }),
        fetch('http://localhost:8000/api/rubrics?admin_view=true&limit=1000', { headers }),
        fetch('http://localhost:8000/api/datasets?admin_view=true&limit=1000', { headers })
      ]);

      const [rulesData, rubricsData, datasetsData] = await Promise.all([
        rulesRes.json(),
        rubricsRes.json(),
        datasetsRes.json()
      ]);

      setRules(rulesData);
      setRubrics(rubricsData);
      setDatasets(datasetsData);

      // Calculate stats
      const statsData: AdminStats = {
        total_rules: rulesData.length,
        total_rubrics: rubricsData.length,
        total_datasets: datasetsData.length,
        total_users: 0, // TODO: Add user count endpoint
        public_rules: rulesData.filter((r: EntityItem) => r.visibility === 'public').length,
        private_rules: rulesData.filter((r: EntityItem) => r.visibility === 'private').length,
        hidden_rules: rulesData.filter((r: EntityItem) => r.visibility === 'hidden').length,
        enabled_rules: rulesData.filter((r: EntityItem) => r.enabled).length,
        disabled_rules: rulesData.filter((r: EntityItem) => !r.enabled).length,
      };

      setStats(statsData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEntityStatus = async (type: 'rules' | 'rubrics' | 'datasets', id: string, updates: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`http://localhost:8000/api/${type}/${id}/admin`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Reload data
        loadAdminData();
      } else {
        console.error('Failed to update entity');
      }
    } catch (error) {
      console.error('Error updating entity:', error);
    }
  };

  const toggleVisibility = (type: 'rules' | 'rubrics' | 'datasets', id: string, currentVisibility: string) => {
    const visibilityOrder = ['public', 'private', 'hidden'];
    const currentIndex = visibilityOrder.indexOf(currentVisibility);
    const nextIndex = (currentIndex + 1) % visibilityOrder.length;
    const newVisibility = visibilityOrder[nextIndex];
    
    updateEntityStatus(type, id, { visibility: newVisibility });
  };

  const toggleEnabled = (type: 'rules' | 'rubrics' | 'datasets', id: string, currentEnabled: boolean) => {
    updateEntityStatus(type, id, { enabled: !currentEnabled });
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Eye className="h-4 w-4 text-green-600" />;
      case 'private':
        return <Eye className="h-4 w-4 text-yellow-600" />;
      case 'hidden':
        return <EyeOff className="h-4 w-4 text-red-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    const variants = {
      public: 'default',
      private: 'secondary',
      hidden: 'destructive'
    } as const;

    return (
      <Badge variant={variants[visibility as keyof typeof variants] || 'default'}>
        {visibility}
      </Badge>
    );
  };

  const EntityTable = ({ entities, type }: { entities: EntityItem[], type: 'rules' | 'rubrics' | 'datasets' }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold capitalize">{type}</h3>
        <Badge variant="outline">{entities.length} total</Badge>
      </div>
      
      <div className="grid gap-4">
        {entities.map((entity) => (
          <Card key={entity.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium truncate">{entity.name}</h4>
                    {getVisibilityIcon(entity.visibility)}
                    {entity.enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  
                  {entity.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {entity.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Owner: {entity.owner_name || 'Unknown'}</span>
                    {entity.organization && <span>Org: {entity.organization}</span>}
                    <span>Created: {new Date(entity.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleVisibility(type, entity.id, entity.visibility)}
                      className="h-8 px-2"
                    >
                      {getVisibilityIcon(entity.visibility)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEnabled(type, entity.id, entity.enabled)}
                      className="h-8 px-2"
                    >
                      {entity.enabled ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex flex-col gap-1 text-xs">
                    {getVisibilityBadge(entity.visibility)}
                    <Badge variant={entity.enabled ? 'default' : 'destructive'}>
                      {entity.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Admin Panel
          </h1>
          <p className="text-gray-600 mt-1">
            Manage system entities, visibility, and user permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {user?.full_name || 'System Admin'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_rules}</div>
              <p className="text-xs text-muted-foreground">
                {stats.enabled_rules} enabled, {stats.disabled_rules} disabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rubrics</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_rubrics}</div>
              <p className="text-xs text-muted-foreground">
                Rule collections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Datasets</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_datasets}</div>
              <p className="text-xs text-muted-foreground">
                Data files
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visibility</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.public_rules}</div>
              <p className="text-xs text-muted-foreground">
                {stats.private_rules} private, {stats.hidden_rules} hidden
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="rubrics">Rubrics</TabsTrigger>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create New User
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Database className="h-4 w-4 mr-2" />
                  Database Backup
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  System Analytics
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest system changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500">
                  Activity logging coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <EntityTable entities={rules} type="rules" />
        </TabsContent>

        <TabsContent value="rubrics">
          <EntityTable entities={rubrics} type="rubrics" />
        </TabsContent>

        <TabsContent value="datasets">
          <EntityTable entities={datasets} type="datasets" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
