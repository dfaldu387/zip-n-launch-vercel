import React from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Users, FileText, Share2, PlusCircle, Clock, CheckCircle } from 'lucide-react';
    import Navigation from '@/components/Navigation';
    import Footer from '@/components/Footer';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
    import { Badge } from '@/components/ui/badge';
    import { Link } from 'react-router-dom';

    const CollaborationHubPage = () => {
      // Dummy data for demonstration purposes
      const myProjects = [
        { id: 1, name: 'Summer Sizzler 2025', status: 'In Progress', collaborators: 3, requests: 2, lastUpdate: '2 hours ago' },
        { id: 2, name: 'Regional Championship', status: 'Proofing', collaborators: 1, requests: 0, lastUpdate: '1 day ago' },
        { id: 3, name: 'Holiday Classic', status: 'Completed', collaborators: 2, requests: 0, lastUpdate: '3 weeks ago' },
      ];

      const sharedWithMe = [
        { id: 4, name: 'State Fair Qualifiers', owner: 'John Doe', role: 'Pattern Contributor', status: 'Pending Patterns', lastUpdate: '5 hours ago' },
        { id: 5, name: 'Youth Club Fun Show', owner: 'Jane Smith', role: 'Proofreader', status: 'Awaiting Review', lastUpdate: '2 days ago' },
      ];

      const ProjectCard = ({ project }) => (
        <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 flex flex-col">
          <CardHeader>
            <CardTitle className="flex justify-between items-start">
              <span className="text-foreground group-hover:text-primary transition-colors">{project.name}</span>
              <Badge variant={project.status === 'Completed' ? 'default' : 'secondary'}>{project.status}</Badge>
            </CardTitle>
            <CardDescription className="flex items-center text-xs pt-1">
              <Clock className="h-3 w-3 mr-1.5" />
              Last updated {project.lastUpdate}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-2" />
              <span>{project.collaborators} Collaborator{project.collaborators !== 1 && 's'}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <FileText className="h-4 w-4 mr-2" />
              <span>{project.requests} Open Pattern Request{project.requests !== 1 && 's'}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">Manage Project</Button>
          </CardFooter>
        </Card>
      );
      
      const SharedProjectCard = ({ project }) => (
        <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 flex flex-col">
          <CardHeader>
            <CardTitle className="flex justify-between items-start">
                <div>
                    <span className="text-foreground group-hover:text-primary transition-colors">{project.name}</span>
                    <p className="text-sm font-normal text-muted-foreground">From: {project.owner}</p>
                </div>
                 <Badge variant="outline">{project.role}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">{project.status}</p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Open Project</Button>
          </CardFooter>
        </Card>
      );

      return (
        <>
          <Helmet>
            <title>Collaboration Hub - EquiPatterns</title>
            <meta name="description" content="Manage your pattern book projects, invite collaborators, and contribute to other projects." />
          </Helmet>
          <div className="min-h-screen bg-background flex flex-col">
            <Navigation />
            <main className="flex-grow container mx-auto px-4 py-8">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <Share2 className="mx-auto h-16 w-16 text-primary mb-4" />
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  Collaboration Hub
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                  Your central place to manage team projects, pattern requests, and proofreading tasks.
                </p>
              </motion.div>

              <div className="space-y-12">
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">My Projects</h2>
                    <Button asChild>
                       <Link to="/pattern-book-builder"><PlusCircle className="h-4 w-4 mr-2" /> New Project</Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myProjects.map((project, i) => (
                      <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <ProjectCard project={project} />
                      </motion.div>
                    ))}
                  </div>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-6">Shared With Me</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sharedWithMe.map((project, i) => (
                             <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                                <SharedProjectCard project={project} />
                             </motion.div>
                        ))}
                    </div>
                </section>
              </div>
            </main>
            <Footer />
          </div>
        </>
      );
    };

    export default CollaborationHubPage;