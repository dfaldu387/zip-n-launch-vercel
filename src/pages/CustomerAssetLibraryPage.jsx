import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Loader2, Search, User, Folder, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminBackButton from '@/components/admin/AdminBackButton';
import { getCustomers, getCustomerDetails } from '@/lib/customerAssetService';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const CustomerAssetLibraryPage = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const { toast } = useToast();
  const [associationsData, setAssociationsData] = useState([]);

  useEffect(() => {
    const fetchAssociations = async () => {
        const { data, error } = await supabase.from('associations').select('*');
        if (error) {
            toast({ title: 'Error fetching associations', description: error.message, variant: 'destructive' });
        } else {
            setAssociationsData(data);
        }
    };
    fetchAssociations();
  }, [toast]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCustomers(searchTerm);
      setCustomers(data);
    } catch (error) {
      toast({ title: 'Error', description: `Failed to fetch customers: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchCustomers]);

  const handleSelectCustomer = async (customer) => {
    if (!customer || !customer.id) {
        toast({ title: 'Error', description: 'Invalid customer selected.', variant: 'destructive' });
        return;
    }
    setSelectedCustomer(customer);
    setIsDetailsLoading(true);
    try {
      const details = await getCustomerDetails(customer.id);
      setCustomerDetails(details);
    } catch (error) {
      toast({ title: 'Error', description: `Failed to fetch customer details: ${error.message}`, variant: 'destructive' });
      setCustomerDetails(null);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const renderProjectData = (project) => {
    if (!project.project_data) return <p>No detailed data available.</p>;
    
    const data = project.project_data;

    const getAssociationNames = () => {
        if (!data.associations) return 'N/A';
        if (Array.isArray(data.associations)) {
            return data.associations.map(a => a.name).join(', ');
        }
        if (typeof data.associations === 'object') {
            return Object.keys(data.associations)
                .filter(id => data.associations[id])
                .map(id => associationsData.find(a => a.id === id)?.name || id)
                .join(', ');
        }
        return 'N/A';
    };
    
    return (
        <div className="space-y-2 text-sm">
            {data.associations && <p><strong>Associations:</strong> {getAssociationNames()}</p>}
            {data.classes && <p><strong>Classes:</strong> {data.classes.length}</p>}
            {data.contactInfo && <p><strong>Contact:</strong> {data.contactInfo.name}</p>}
            {data.showDetails?.general?.showName && <p><strong>Show Name:</strong> {data.showDetails.general.showName}</p>}
        </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Customer Asset Library - Admin</title>
        <meta name="description" content="Browse and manage customer projects and assets." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center justify-between mb-8">
                <AdminBackButton />
                <div className="text-center flex-grow">
                    <CardTitle className="text-4xl md:text-5xl font-bold">Customer Asset Library</CardTitle>
                    <CardDescription className="text-xl text-muted-foreground">A centralized view of all customer data and projects.</CardDescription>
                </div>
                <div className="w-48"></div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Search Customers</CardTitle>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                  ) : (
                    <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {customers.map((customer) => (
                        <li key={customer.id}>
                          <Button
                            variant={selectedCustomer?.id === customer.id ? 'secondary' : 'ghost'}
                            className="w-full justify-start"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <User className="mr-2 h-4 w-4" />
                            <div className="text-left">
                              <p className="font-semibold">{customer.full_name || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{customer.email}</p>
                            </div>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              {isDetailsLoading ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>
              ) : selectedCustomer && customerDetails ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">{customerDetails.customer.full_name}</CardTitle>
                      <CardDescription>{customerDetails.customer.email}</CardDescription>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><Folder className="mr-2 h-5 w-5" /> Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerDetails.projects && customerDetails.projects.length > 0 ? (
                            customerDetails.projects.map((project) => (
                              <TableRow key={project.id}>
                                <TableCell className="font-medium">{project.project_name}</TableCell>
                                <TableCell><Badge variant="outline">{project.project_type}</Badge></TableCell>
                                <TableCell><Badge>{project.status || 'Completed'}</Badge></TableCell>
                                <TableCell>{new Date(project.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{renderProjectData(project)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow><TableCell colSpan="5" className="text-center">No projects found for this customer.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> Uploaded Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerDetails.assets && customerDetails.assets.length > 0 ? (
                            customerDetails.assets.map((asset) => (
                            <TableRow key={asset.id}>
                              <TableCell className="font-medium">{asset.custom_name || asset.file_name}</TableCell>
                              <TableCell><Badge variant="secondary">{asset.asset_type}</Badge></TableCell>
                              <TableCell>
                                {customerDetails.projects.find(p => p.id === asset.project_id)?.project_name || 'N/A'}
                              </TableCell>
                              <TableCell>{new Date(asset.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> View</Button>
                                </a>
                              </TableCell>
                            </TableRow>
                          ))
                          ) : (
                             <TableRow><TableCell colSpan="5" className="text-center">No assets found for this customer.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="flex flex-col justify-center items-center h-full text-center p-8 bg-muted/30 rounded-lg">
                  <Search className="h-16 w-16 text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold">Select a Customer</h2>
                  <p className="text-muted-foreground">Search for a customer on the left to view their projects and assets.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default CustomerAssetLibraryPage;