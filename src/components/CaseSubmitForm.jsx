import React, { useState } from 'react';
import { Form, Input, InputNumber, Select, Button, message } from 'antd';
import api from '../services/api';

const CaseSubmitForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // Submit case to backend
      const response = await api.post('/cases', {
        title: values.title,
        description: values.description,
        priority: values.priority,
        caseOrigin: values.caseOrigin,
        // Note: requiredSkills will be determined automatically by backend
      });

      if (response.data.success) {
        message.success('Case submitted successfully!');
        form.resetFields();
      } else {
        message.error('Failed to submit case: ' + response.data.message);
      }
    } catch (error) {
      message.error('Error submitting case: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      name="case_submit"
      onFinish={handleSubmit}
      autoComplete="off"
      style={{ maxWidth: 600, margin: '0 auto' }}
    >
      <Form.Item
        label="Case Title"
        name="title"
        rules={[{
          required: true,
          message: 'Please enter case title'
        }]}
      >
        <Input placeholder="Enter case title" />
      </Form.Item>

      <Form.Item
        label="Case Description"
        name="description"
        rules={[{
          required: true,
          message: 'Please enter case description'
        }]}
      >
        <Input.TextArea rows={4} placeholder="Describe the issue in detail" />
      </Form.Item>

      <Form.Item
        label="Priority"
        name="priority"
        initialValue="medium"
      >
        <Select>
          <Select.Option value="low">Low</Select.Option>
          <Select.Option value="medium">Medium</Select.Option>
          <Select.Option value="high">High</Select.Option>
          <Select.Option value="urgent">Urgent</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Channel"
        name="caseOrigin"
        initialValue="web"
      >
        <Select>
          <Select.Option value="web">Web Form</Select.Option>
          <Select.Option value="phone">Phone Call</Select.Option>
          <Select.Option value="email">Email</Select.Option>
          <Select.Option value="social">Social Media</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Submit Case
        </Button>
        <Button htmlType="reset" style={{ marginLeft: 8 }}>
          Reset
        </Button>
      </Form.Item>
    </Form>
  );
};

export default CaseSubmitForm;