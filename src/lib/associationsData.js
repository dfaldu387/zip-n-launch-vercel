import { supabase } from './supabaseClient';
import { Shield, Users, Star, Award, School as University, Clover } from 'lucide-react';

const logoMap = {
  Users,
  Horse: Star,
  Star,
  Award,
  University,
  Clover,
  Shield,
};

let associationsDataCache = null;

export const addLogoToAssociations = (associations) => {
  if (!Array.isArray(associations)) {
    return [];
  }
  return associations.map(assoc => {
    const hasHttpLogo = assoc.logo && typeof assoc.logo === 'string' && assoc.logo.startsWith('http');
    return {
      ...assoc,
      logo_url: hasHttpLogo ? assoc.logo : null,
      IconComponent: !hasHttpLogo ? (logoMap[assoc.logo] || Shield) : null,
    };
  });
};

export const fetchAssociations = async () => {
    if (associationsDataCache) {
        return associationsDataCache;
    }

    const { data, error } = await supabase
        .from('associations')
        .select('*')
        .order('position', { ascending: true });

    if (error) {
        console.error('Error fetching associations:', error);
        return [];
    }
    
    associationsDataCache = addLogoToAssociations(data);
    return associationsDataCache;
};

export const getAssociationLogo = (association) => {
  if (association && association.logo_url) {
    return association.logo_url;
  }
  return null;
};

export const getDefaultAssociationIcon = (association) => {
  if (association && association.IconComponent) {
    return association.IconComponent;
  }
  return Shield;
};