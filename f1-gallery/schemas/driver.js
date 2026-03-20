export default {
  name: 'driver',
  title: 'Driver',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Driver Name',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'number',
      title: 'Driver Number',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'team',
      title: 'Team',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'teamColor',
      title: 'Team Color',
      type: 'string',
      description: 'Hex color code (e.g., #DC0000)',
      validation: Rule => Rule.required()
    },
    {
      name: 'image',
      title: 'Driver Image',
      type: 'image',
      options: {
        hotspot: true
      }
    },
    {
      name: 'moments',
      title: 'Moments',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'moment' }] }]
    }
  ]
}