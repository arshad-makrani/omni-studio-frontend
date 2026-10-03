import React, { useState, useEffect } from 'react';
import { Table, Button, Spin, message, Dropdown, Menu } from 'antd';
import { DownOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, SyncOutlined } from '@ant-design/icons';
import api from '../services/api';

const AgentDashboard = () => {
  let [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log('AgentDashboard component mounted');

  const columns = [
    {
      title: 'Case Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Case Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Channel',
      dataIndex: 'routingChannel',
      key: 'channel',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: 'Assigned At',
      dataIndex: 'assignedAt',
      key: 'assignedAt',
      render: (text) => {
        if (!text) return '-';
        const date = new Date(text);
        return date.toLocaleString();
      },
    },
    {
      title: 'Skill Match',
      dataIndex: 'skillMatchScore',
      key: 'skillMatch',
      render: (text) => `${text}%`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => {
        console.log('🔹 Actions render for record:', record);
        return (
          <Dropdown overlay={
            <Menu>
              {record.status === 'assigned' && (
                <>
                  <Menu.Item key="accept" onClick={() => {
                    console.log('🔹 Accept clicked for record:', record);
                    handleMenuClick('accept', record);
                  }}>
                    <CheckCircleOutlined /> Accept
                  </Menu.Item>
                  <Menu.Item key="decline" onClick={() => {
                    console.log('🔹 Decline clicked for record:', record);
                    handleMenuClick('decline', record);
                  }}>
                    <CloseCircleOutlined /> Decline
                  </Menu.Item>
                </>
              )}
              {record.status === 'accepted' && (
                <Menu.Item key="start" onClick={() => handleMenuClick('start', record)}>
                  <LoadingOutlined /> Start Work
                </Menu.Item>
              )}
              {record.status === 'inProgress' && (
                <Menu.Item key="resolve" onClick={() => handleMenuClick('resolve', record)}>
                  <CheckCircleOutlined /> Resolve
                </Menu.Item>
              )}
            </Menu>
          } trigger={['click']} getPopupContainer={() => document.body} onVisibleChange={visible => console.log('Dropdown visible:', visible)} overlayStyle={{ zIndex: 1000 }}>
            <Button size="small" icon={<DownOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  const handleMenuClick = async (key, record) => {
    console.log('🔹 handleMenuClick called with key:', key, 'record:', record);
    if (!record?.id) {
      console.error('⚠️ Record missing id:', record);
      message.error('Invalid record: missing id');
      return;
    }
    try {
      let response;
      console.log(`🔸 About to call PATCH /assignments/${record.id}/${key}`);
      switch (key) {
        case 'accept':
          response = await api.patch(`/assignments/${record.id}/accept`);
          break;
        case 'decline':
          response = await api.patch(`/assignments/${record.id}/decline`);
          break;
        case 'start':
          response = await api.patch(`/assignments/${record.id}/start`);
          break;
        case 'resolve':
          response = await api.patch(`/assignments/${record.id}/resolve`);
          break;
        default:
          console.warn('⚠️ Unknown menu key:', key);
          return;
      }

      console.log('🔸 API response:', response);

      if (response.data?.success) {
        message.success(`Action ${key}ed successfully`);
        console.log('✅ Action successful, refetching assignments');
        fetchAssignments();
      } else {
        const msg = response.data?.message || 'Unknown error';
        message.error(`Failed to ${key}: ${msg}`);
        console.error('❌ Action failed:', response.data);
      }
    } catch (error) {
      console.error('🚨 Error in handleMenuClick:', error);
      message.error(`Error: ${error.message}`);
    }
  };

  const fetchAssignments = async () => {
    console.log('fetchAssignments called');
    setLoading(true);
    try {
      // Fetch all assignments (in a real app, we would filter by auth agentId)
      console.log('Fetching all assignments');
      const response = await api.get(`/assignments`);
      console.log('Assignments response received:', response);
      if (response.data.success) {
        // Flatten the data: pull case fields onto the assignment object
        const flattened = response.data.data.map(assign => ({
          ...assign,
          title: assign.case?.title,
          description: assign.case?.description,
          priority: assign.case?.priority,
          // keep the original case object if needed elsewhere
          // case: assign.case,
        }));
        // Log first item for debugging
        if (flattened.length > 0) {
          console.log('First assignment:', flattened[0]);
        }
        setAssignments(flattened);
        console.log('Assignments set in state (flattened):', flattened);
        console.log('Number of assignments:', flattened.length);
      } else {
        message.error('Failed to fetch assignments');
        console.error('API returned success false:', response.data);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      message.error('Error fetching assignments');
    } finally {
      console.log('fetchAssignments finally block, setting loading to false');
      console.log('Assignments update ---- :', assignments);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered');
    fetchAssignments();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spin tip="Loading assignments..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>My Assigned Work</h2>
      <div>
        Assignments count: {assignments.length}
        {assignments.length > 0 && (
          <pre style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(assignments.slice(0, 2), null, 2)}
          </pre>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={assignments}
        pagination={{ pageSize: 10 }}
        rowKey="id"
        loading={loading}
      />
    </div>
  );
};

export default AgentDashboard;