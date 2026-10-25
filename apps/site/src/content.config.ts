import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        description: z
          .string()
          .max(160, 'Description must be at most 160 characters')
          .optional(),
        status: z.enum(['available', 'in-progress', 'planned']).default('available'),
        since: z.string().optional(),
        area: z
          .enum(['start', 'guides', 'algorithms', 'reference', 'design', 'project'])
          .default('start'),
        order: z.number().optional(),
        tags: z.array(z.string()).optional(),
        traits: z
          .object({
            memoryPerKey: z.string(),
            burstBehavior: z.string(),
            boundaryBehavior: z.string(),
            accuracy: z.string().optional(),
            exactness: z.string().optional(),
            stateSize: z.string().optional(),
          })
          .optional(),
      }),
    }),
  }),
};
