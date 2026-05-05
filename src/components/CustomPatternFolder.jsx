import React from 'react';
import { motion } from 'framer-motion';
import { Folder } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export const CustomPatternFolder = ({ className, patternCount }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <Link to={`/admin/custom-pattern-set/${encodeURIComponent(className)}`}>
        <Card className="h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer bg-secondary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Folder className="h-10 w-10 text-primary" />
            <Badge variant="secondary" className="text-lg">
              {patternCount}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{className}</div>
            <p className="text-xs text-muted-foreground">Pattern Sets</p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};