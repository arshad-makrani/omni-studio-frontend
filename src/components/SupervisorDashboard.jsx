import React, { useState, useEffect } from 'react';
import { Table, Button, Spin, message, Row, Col, Card, Statistic, Space, Tabs } from 'antd';
import { PieChart, BarChart, LineChart, ComposedChart, Area, Bar, Line, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import api from '../services/api';

const SupervisorDashboard = () => {
  const [stats, setStats] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [completedRequests, setCompletedRequests] = useState(0);

  console.log('SupervisorDashboard component mounted');

  // Reset completed requests when component mounts or remounts
  useEffect(() => {
    setCompletedRequests(0);
    setLoading(true);
  }, []);

  const columns = [
    {
      title: 'Case Title',
      dataIndex: 'case.title',
      key: 'title',
    },
    {
      title: 'Agent',
      dataIndex: 'agent.name',
      key: 'agent',
    },
    {
      title: 'Channel',
      dataIndex: 'routingChannel',
      key: 'channel',
    },
    {
      title: 'Priority',
      dataIndex: 'case.priority',
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
    },
    {
      title: 'Skill Match',
      dataIndex: 'skillMatchScore',
      key: 'skillMatch',
      render: (text) => `${text}%`,
    },
  ];

  const fetchStats = async () => {
    console.log('fetchStats called');
    try {
      const response = await api.get('/dashboard/stats');
      console.log('fetchStats response:', response);
      if (response.data.success) {
        setStats(response.data.data);
        console.log('Stats set:', response.data.data);
      } else {
        message.error('Failed to fetch stats');
        console.error('API returned success false:', response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      message.error('Error fetching stats');
    } finally {
      // Increment completed requests and check if all done
      setCompletedRequests(prev => {
        const newPrev = prev + 1;
        if (newPrev >= 2) {
          console.log('All requests completed, setting loading to false');
          setLoading(false);
        }
        return newPrev;
      });
    }
  };

  const fetchAssignments = async () => {
    console.log('fetchAssignments called');
    try {
      const response = await api.get('/assignments');
      console.log('fetchAssignments response:', response);
      if (response.data.success) {
        setAssignments(response.data.data);
        console.log('Assignments set:', response.data.data);
        // Log first assignment to see structure
        if (response.data.data.length > 0) {
          console.log('First assignment:', JSON.stringify(response.data.data[0], null, 2));
        }
      } else {
        message.error('Failed to fetch assignments');
        console.error('API returned success false:', response.data);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      message.error('Error fetching assignments');
    } finally {
      // Increment completed requests and check if all done
      setCompletedRequests(prev => {
        const newPrev = prev + 1;
        if (newPrev >= 2) {
          console.log('All requests completed, setting loading to false');
          setLoading(false);
        }
        return newPrev;
      });
    }
  };

  useEffect(() => {
    console.log('useEffect triggered in SupervisorDashboard');
    fetchStats();
    fetchAssignments();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spin tip="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Supervisor Dashboard</h2>

      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
        <Tabs.TabPane tab="Overview" key="overview">
          {/* Stats Cards */}
          <Row gutter={16}>
            <Col span={6}>
              <Card title="Total Cases">
                <Statistic value={stats.totalCases || 0} />
              </Card>
            </Col>
            <Col span={6}>
              <Card title="Pending Assignments">
                <Statistic value={stats.pendingAssignments || 0} />
              </Card>
            </Col>
            <Col span={6}>
              <Card title="Average Skill Match">
                <Statistic value={stats.avgSkillMatch || 0} precision={1} />
              </Card>
            </Col>
            <Col span={6}>
              <Card title="SLA Compliance">
                <Statistic
                  value={stats.slaCompliance || 0}
                  precision={1}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>

          {/* Charts */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Cases by Channel">
                <PieChart
                  width={400}
                  height={300}
                  data={stats.casesByChannel || []}
                >
                  {stats.casesByChannel && stats.casesByChannel.map((entry, index) => (
                    <Bar key={`channel-${index}`} dataKey="count" fill={`#${((index+1)*0xFFFFFF>>0).toString(16).padStart(6, '0')}`} />
                  ))}
                  <Cell />
                </PieChart>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Cases by Reason">
                <BarChart
                  width={600}
                  height={300}
                  data={stats.casesByReason || []}
                >
                  <Bar dataKey="count" fill="#82ca9d" />
                  <XAxis dataKey="reason" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                </BarChart>
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>

        <Tabs.TabPane tab="All Assignments" key="assignments">
          {/* Assignments Table */}
          <Card title="All Assignments" bordered={false}>
            <Table
              columns={columns}
              dataSource={assignments}
              pagination={{ pageSize: 10 }}
              rowKey="id"
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default SupervisorDashboard;