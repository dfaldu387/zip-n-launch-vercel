import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Store as StoreIcon, Search, FileText, BookOpen, Star, Download, Check, MapPin, Tag } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

const StorePage = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState('all');
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

  useEffect(() => {
    const patterns = JSON.parse(localStorage.getItem('equiPatterns') || '[]');
    
    const formattedPatterns = patterns.map(p => ({
      ...p,
      type: 'Pattern',
      productType: 'pattern',
      price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
      isBreedReady: associationsData.some(a => a.id === p.association),
    }));
    
    const breedShowPackage = {
      id: 'breed-show-package',
      title: 'Easy Pattern Book Builder',
      description: 'A turnkey, breed-specific show bundle: association-compatible patterns, auto-filled score sheets, QR posters, and live-feed show page.',
      price: 250.00,
      type: 'Service',
      productType: 'service',
      customizable: true,
      disciplines: ['Breed-Specific', 'All-Inclusive'],
      isBreedReady: true,
      association: 'Multiple',
      includes: [
        'Patterns tagged and validated for your selected association',
        'AI-prepared score sheets mapped to association’s template',
        'QR Poster Pack (per class) with sponsor pre-roll support',
        'Hosted Show Page with embedded live stream',
        'Reuse protection (30 days / 250 miles)',
        'Branding options: Light, Dark, or Custom Colors (add-on)',
      ]
    };

    setProducts([breedShowPackage, ...formattedPatterns]);
  }, [associationsData]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchMatch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.tags && product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (product.disciplines && product.disciplines.some(discipline => discipline.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const associationMatch = selectedAssociation === 'all' || product.association === selectedAssociation || product.association === 'Multiple';

      return searchMatch && associationMatch;
    });
  }, [products, searchTerm, selectedAssociation]);

  const handlePurchase = (product) => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      description: `Product: ${product.title} - $${product.price.toFixed(2)}`,
    });
  };

  const ProductCard = ({ product, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="flex"
    >
      <Card className="bg-secondary border-border hover:border-primary/50 transition-all duration-300 group h-full flex flex-col w-full">
        <CardHeader className="pb-4">
          <div className="aspect-video bg-background rounded-lg mb-4 flex items-center justify-center pattern-grid overflow-hidden relative">
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center p-4 text-center">
              <span className="text-muted-foreground text-sm">{product.title}</span>
            </div>
            <Badge variant="secondary" className="absolute top-2 left-2">
              {product.type === 'Pattern' ? <FileText className="h-4 w-4 mr-1.5" /> : <BookOpen className="h-4 w-4 mr-1.5" />}
              {product.type}
            </Badge>
            {product.isBreedReady && product.association && (
              <Badge variant="default" className="absolute top-2 right-2">
                 <Tag className="h-3 w-3 mr-1" /> Breed-Ready: {product.association}
              </Badge>
            )}
          </div>
          <CardTitle className="text-foreground group-hover:text-primary transition-colors text-xl font-bold">{product.title}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          {product.includes ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {product.includes.map((item, i) => (
                <li key={i} className="flex items-start">
                  <Check className="h-4 w-4 mr-2 mt-0.5 text-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs">
              {product.type === 'Pattern' && (
                <>
                  <Badge variant="outline">{product.association}</Badge>
                  <Badge variant="outline">{product.difficulty}</Badge>
                  <Badge variant="outline">{product.category}</Badge>
                </>
              )}
              {product.type === 'Pattern Book' && product.disciplines && (
                 <>
                  {product.disciplines.slice(0, 3).map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
                  {product.disciplines.length > 3 && <Badge variant="outline">+{product.disciplines.length - 3} more</Badge>}
                 </>
              )}
            </div>
          )}
           {product.isBreedReady && (
            <p className="text-xs text-green-400 mt-3 flex items-center">
              <MapPin className="h-3 w-3 mr-1.5" />
              Eligible today for {selectedAssociation !== 'all' ? selectedAssociation : 'your association'} in your area
            </p>
          )}
        </CardContent>
        <CardFooter className="pt-4 flex-col items-stretch">
          <div className="flex justify-between items-center w-full mb-4">
            <div className="text-3xl font-bold text-foreground">${product.price.toFixed(2)}</div>
            {product.rating && (
              <div className="flex items-center space-x-1 text-primary shrink-0 ml-2">
                <Star className="h-5 w-5 fill-current" />
                <span className="text-sm font-semibold">{product.rating}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full">
            {product.id === 'breed-show-package' ? (
              <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/easy-pattern-book-builder">
                  <Download className="h-4 w-4 mr-2" /> Start Building
                </Link>
              </Button>
            ) : (
              <Button onClick={() => handlePurchase(product)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Download className="h-4 w-4 mr-2" /> Purchase
              </Button>
            )}
            {product.customizable && product.id !== 'breed-show-package' && (
              <Button asChild variant="outline" className="w-full">
                <Link to={`/customize/${product.id}`}>Customize</Link>
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );

  return (
    <>
      <Helmet>
        <title>Store - EquiPatterns</title>
        <meta name="description" content="Browse and purchase official patterns, pattern books, and digital products from EquiPatterns." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <StoreIcon className="mx-auto h-16 w-16 text-primary mb-4" />
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Welcome to the Store
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Find exclusive patterns, pattern books, and more to enhance your equestrian events.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="glass-effect rounded-lg p-6 mb-8 border border-border max-w-3xl mx-auto flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input placeholder="Search patterns and books..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-12" />
            </div>
            <div className="md:w-1/3">
              <Select onValueChange={setSelectedAssociation} defaultValue="all">
                <SelectTrigger className="h-12 bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Filter by Association" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Associations</SelectItem>
                  {associationsData.map(assoc => (
                    <SelectItem key={assoc.id} value={assoc.id}>{assoc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product, index) => (
              <ProductCard key={`${product.productType}-${product.id}`} product={product} index={index} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <div className="text-muted-foreground text-2xl font-semibold">No products found.</div>
              <p className="text-muted-foreground/80 mt-2">Try adjusting your search filters.</p>
            </motion.div>
          )}
        </main>
      </div>
    </>
  );
};

export default StorePage;