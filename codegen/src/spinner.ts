import ora from 'ora';

export const spinner = process.env.NODE_ENV === 'test' ? null : ora();
