export default {
  name: 'moment',
  title: 'Moment',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required()
    },
    {
      name: 'date',
      title: 'Date',
      type: 'date',
      validation: Rule => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: Rule => Rule.required()
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Image', value: 'image' },
          { title: 'Video', value: 'video' }
        ],
        layout: 'radio'
      },
      validation: Rule => Rule.required()
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true
      },
      hidden: ({ parent }) => parent?.type !== 'image'
    },
    {
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description: 'YouTube or other video embed URL',
      hidden: ({ parent }) => parent?.type !== 'video'
    },
    {
      name: 'radio',
      title: 'Team Radio Message',
      type: 'text',
      description: 'Optional team radio transcript'
    }
  ]
}