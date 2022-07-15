import { xataWorker } from './xata';
import _ from 'lodash';
import React from 'react';
import { useQuery } from 'react-query';

const getBlogs = xataWorker('get-blogs', async ({ xata }) => {
  return xata.db.blogs.getAll();
});

export const BlogPage = () => {
  const { data: blogs = [] } = useQuery('blogs', getBlogs);

  return (
    <>
      <h1>Blogs</h1>

      {blogs.map((blog) => (
        <p key={blog.id}>{blog.title}</p>
      ))}
    </>
  );
};
