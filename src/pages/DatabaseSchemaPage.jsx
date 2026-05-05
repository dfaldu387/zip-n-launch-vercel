import React from 'react';
import { motion } from 'framer-motion';
import { Database, Key, Link2, ListOrdered, Search } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const schemaData = {
  "Core Entities": {
    users: [
      { name: 'id', type: 'PK', desc: 'Primary Key' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'role', type: 'enum', desc: '[organizer, buyer, designer, admin]' },
      { name: 'org_id', type: 'FK', desc: '-> organizations.id' },
      { name: 'created_at', type: 'timestamp' },
    ],
    designers: [
      { name: 'id', type: 'PK' },
      { name: 'user_id', type: 'FK', desc: '-> users.id' },
      { name: 'bio', type: 'text' },
      { name: 'headshot_url', type: 'string' },
      { name: 'public_profile_slug', type: 'string' },
      { name: 'payout_info', type: 'json' },
    ],
    associations: [
      { name: 'id', type: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'code', type: 'string' },
      { name: 'ruleset_url', type: 'string' },
    ],
    venues: [
      { name: 'id', type: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'address', type: 'string' },
      { name: 'lat', type: 'float', desc: 'PostGIS Point' },
      { name: 'lng', type: 'float', desc: 'PostGIS Point' },
    ],
    shows: [
      { name: 'id', type: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'association_id', type: 'FK', desc: '-> associations.id' },
      { name: 'venue_id', type: 'FK', desc: '-> venues.id' },
      { name: 'start_date', type: 'date' },
      { name: 'end_date', type: 'date' },
      { name: 'livestream_embed_url', type: 'string' },
      { name: 'status', type: 'enum' },
    ],
    sponsors: [
      { name: 'id', type: 'PK' },
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'logo_url', type: 'string' },
    ],
  },
  "Patterns & Tagging": {
    patterns: [
      { name: 'id', type: 'PK' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'designer_id', type: 'FK', desc: '-> designers.id' },
      { name: 'association_id', type: 'FK', desc: '-> associations.id (nullable)' },
      { name: 'difficulty', type: 'enum' },
      { name: 'status', type: 'enum' },
    ],
    pattern_tags: [
      { name: 'pattern_id', type: 'FK', desc: '-> patterns.id' },
      { name: 'tag_id', type: 'FK', desc: '-> tags.id' },
    ],
  },
  "Commerce & Customization": {
    orders: [
      { name: 'id', type: 'PK' },
      { name: 'user_id', type: 'FK', desc: '-> users.id' },
      { name: 'total', type: 'decimal' },
      { name: 'status', type: 'enum' },
    ],
    order_items: [
      { name: 'id', type: 'PK' },
      { name: 'order_id', type: 'FK', desc: '-> orders.id' },
      { name: 'pattern_id', type: 'FK', desc: '-> patterns.id' },
      { name: 'branding_type', type: 'enum' },
    ],
    customizations: [
      { name: 'id', type: 'PK' },
      { name: 'order_item_id', type: 'FK', desc: '-> order_items.id' },
      { name: 'event_name', type: 'string' },
      { name: 'venue_lat', type: 'float' },
      { name: 'venue_lng', type: 'float' },
    ],
    qr_links: [
      { name: 'id', type: 'PK' },
      { name: 'order_item_id', type: 'FK', desc: '-> order_items.id' },
      { name: 'signed_path', type: 'string', desc: 'Unique' },
    ],
  },
  "Usage & Compliance": {
    pattern_usage: [
      { name: 'id', type: 'PK' },
      { name: 'pattern_id', type: 'FK', desc: '-> patterns.id' },
      { name: 'date', type: 'date' },
      { name: 'venue_lat', type: 'float', desc: 'GiST Index' },
      { name: 'venue_lng', type: 'float', desc: 'GiST Index' },
    ],
    reuse_checks: [
      { name: 'id', type: 'PK' },
      { name: 'order_item_id', type: 'FK', desc: '-> order_items.id' },
      { name: 'passed', type: 'boolean' },
    ],
  },
  "Score Sheets": {
    score_sheet_templates: [
      { name: 'id', type: 'PK' },
      { name: 'association_id', type: 'FK', desc: '-> associations.id' },
      { name: 'schema_json', type: 'json' },
    ],
    score_sheets: [
      { name: 'id', type: 'PK' },
      { name: 'pattern_id', type: 'FK', desc: '-> patterns.id' },
      { name: 'filled_json', type: 'json' },
    ],
    ai_extractions: [
      { name: 'id', type: 'PK' },
      { name: 'source_id', type: 'integer' },
      { name: 'mapped_fields_json', type: 'json' },
    ],
  },
};

const ColumnBadge = ({ type }) => {
  const badgeStyles = {
    PK: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    FK: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
    default: 'bg-secondary text-muted-foreground border-border',
  };
  const style = badgeStyles[type] || badgeStyles.default;
  return <Badge variant="outline" className={`w-12 text-center justify-center ${style}`}>{type}</Badge>;
};

const DatabaseSchemaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-12">
          <Database className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Database Schema</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A blueprint of the relational database powering the EquiPatterns platform.
          </p>
        </motion.div>

        {Object.entries(schemaData).map(([category, tables], catIndex) => (
          <motion.div key={category} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: catIndex * 0.1 }} className="mb-12">
            <h2 className="text-2xl font-semibold text-primary mb-6 border-b border-primary/20 pb-2">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(tables).map(([tableName, columns]) => (
                <Card key={tableName} className="bg-secondary border-border h-full">
                  <CardHeader>
                    <CardTitle className="font-mono text-lg text-foreground">{tableName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {columns.map(col => (
                        <div key={col.name} className="flex items-center justify-between text-sm font-mono">
                          <div className="flex items-center gap-3">
                            <ColumnBadge type={col.type} />
                            <span>{col.name}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">{col.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
          <h2 className="text-2xl font-semibold text-primary mb-6 border-b border-primary/20 pb-2">Key Constraints & Queries</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" /> Indices</CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-sm space-y-2">
                <p>GiST index on <code className="bg-background p-1 rounded">venues(lat, lng)</code></p>
                <p>GiST index on <code className="bg-background p-1 rounded">pattern_usage(venue_lat, venue_lng)</code></p>
                <p>B-Tree index on <code className="bg-background p-1 rounded">pattern_usage(pattern_id, date)</code></p>
                <p>Unique index on <code className="bg-background p-1 rounded">qr_links(signed_path)</code></p>
              </CardContent>
            </Card>
            <Card className="bg-secondary border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Core Queries</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <h4 className="font-semibold text-foreground">Distance Rule</h4>
                  <p className="text-muted-foreground">Find prior <code className="text-xs bg-background p-0.5 rounded">pattern_usage</code> within 250 miles where date difference is ≤ 30 days.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Time Rule</h4>
                  <p className="text-muted-foreground">Find any prior <code className="text-xs bg-background p-0.5 rounded">pattern_usage</code> for a pattern in the last 30 days, globally.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DatabaseSchemaPage;